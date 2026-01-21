import google.generativeai as genai
from decouple import config
from django.conf import settings
import json
import logging

logger = logging.getLogger(__name__)

def configure_genai():
    """Configure the Google Generative AI with the API key."""
    api_key = config('GEMINI_API_KEY', default=None)
    if not api_key or api_key == 'YOUR_GEMINI_API_KEY_HERE':
        logger.error("GEMINI_API_KEY not found or invalid in environment variables.")
        return False
    genai.configure(api_key=api_key)
    return True

def analyze_invoice_image(image_file):
    """
    Analyzes an invoice image using Google Gemini and extracts product numbers and quantities.
    
    Args:
        image_file: The uploaded image file object.
        
    Returns:
        A list of dictionaries with 'product_number' and 'quantity', or None if error.
    """
    if not configure_genai():
        return {"error": "API Key not configured"}

    try:
        # Read image data once
        image_data = image_file.read()
        mime_type = getattr(image_file, 'content_type', 'image/jpeg')
        
        # Prepare the prompt
        prompt = """
        You are an AI assistant specialized in analyzing inventory invoices handwritten or printed in ARABIC.
        Please analyze this image and extract all product numbers and their quantities.
        
        CRITICAL: ARABIC NUMERALS & RTL LAYOUT
        - The image likely contains Eastern Arabic Numerals (Hindi numerals): ٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩
        - You MUST recognize these digits correctly and transcode them to Western Arabic numerals (0-9) for the JSON output.
        - Mapping: ٠=0, ١=1, ٢=2, ٣=3, ٤=4, ٥=5, ٦=6, ٧=7, ٨=8, ٩=9.
        - Be aware of Right-to-Left (RTL) reading order for text columns.
        - Product numbers are usually multi-digit integers (e.g., ٤٥٦٣ -> 4563).
        - Pay extreme attention to distinguishing between '٢' (2) and '٣' (3) if handwritten, and '٠' (0) vs '٥' (5) in some handwritings (though 0 is usually a dot).
        
        CRITICAL INSTRUCTIONS FOR QUANTITY CALCULATION:
        - The "Quantity" column in the image represents DOZENS, not individual units.
        - You MUST convert all quantities into INDIVIDUAL UNITS (pieces) by multiplying by 12.
        - Return the FINAL calculated integer of units.
        
        Conversion Rules:
        - If you see "1" or "١", it means 1 Dozen = 12 units.
        - If you see "2" or "٢", it means 2 Dozen = 24 units.
        - If you see "3" or "٣", it means 3 Dozen = 36 units.
        - If you see "5" or "٥", it means 5 Dozen = 60 units.
        - If you see "1/2" or "١/٢" or "نصف" or "Half", it means 0.5 Dozen = 6 units.
        - If you see "1 1/2" or "١ ١/٢" or "1.5", it means 1.5 Dozen = 18 units.
        - If you see "1/4" or "١/٤" or "ربع", it means 0.25 Dozen = 3 units.
        - If the quantity is blank, assume 1 unit (NOT 1 dozen, just 1 piece unless it clearly implies a dozen context, but safer to assume 1 piece if empty).
        
        Refined Logic:
        - Integer 'N' -> N * 12 units.
        - Fraction 'A/B' -> (A/B) * 12 units.
        - Mixed Fraction 'N A/B' -> (N + A/B) * 12 units.
        - Text "Dozen" -> 12 units.
        - Text "Half Dozen" -> 6 units.
        
        Return the result strictly as a JSON list of objects, where each object has:
        - "number": the product number (string, Western digits)
        - "quantity": the calculated quantity in UNITS (integer)
        
        Ignore any text that doesn't look like a product number or quantity.
        Do not include any markdown formatting like ```json ... ```, just the raw JSON string.
        """

        # List of models to try in order of preference/likelihood of working
        models_to_try = [
            'gemini-2.0-flash-exp',    # Often free/unlimited during preview
            'gemini-flash-latest',     # Latest stable flash
            'gemini-1.5-flash',        # Standard flash
            'gemini-1.5-pro',          # Standard pro (might have quota)
            'gemini-2.0-flash'         # New flash (was hitting limit 0)
        ]
        
        last_error = None
        
        for model_name in models_to_try:
            try:
                logger.info(f"Attempting image analysis with model: {model_name}")
                model = genai.GenerativeModel(model_name)
                
                # Generate content
                response = model.generate_content([
                    {'mime_type': mime_type, 'data': image_data},
                    prompt
                ])
                
                # If we get here, the call was successful
                response_text = response.text.strip()
                logger.info(f"Successfully analyzed image with model: {model_name}")
                
                # Clean up potential markdown code blocks
                if response_text.startswith("```json"):
                    response_text = response_text[7:]
                if response_text.startswith("```"):
                    response_text = response_text[3:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                    
                response_text = response_text.strip()
                
                try:
                    products = json.loads(response_text)
                    
                    # Validate and format the result
                    formatted_products = []
                    for item in products:
                        number = str(item.get('number', '')).strip()
                        try:
                            quantity = int(item.get('quantity', 1))
                        except (ValueError, TypeError):
                            quantity = 1
                            
                        if number:
                            formatted_products.append({
                                'product_number': number,
                                'quantity': quantity
                            })
                    
                    return formatted_products
                    
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse JSON from Gemini response ({model_name}): {e}. Response: {response_text}")
                    last_error = f"Failed to parse AI response from {model_name}"
                    continue # Try next model if JSON parsing fails (unlikely but possible)

            except Exception as e:
                logger.warning(f"Model {model_name} failed: {e}")
                last_error = str(e)
                continue # Try next model
        
        # If we exhausted all models
        if last_error:
            return {"error": f"All AI models failed. Last error: {last_error}"}
        else:
            return {"error": "Unknown error occurred during AI analysis"}

    except Exception as e:
        logger.error(f"Error preparing image analysis: {e}")
        return {"error": str(e)}