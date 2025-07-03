import cv2
import numpy as np
import pytesseract
from config import *

def detect_elements(img, thresh):
    debug_img = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
    contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    elements = []
    for cnt in contours:
        try:
            area = cv2.contourArea(cnt)
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = w / h

            # Skip based on size
            if not (MIN_ELEMENT_AREA <= area <= MAX_ELEMENT_AREA):
                continue
                
            # Get ROI with padding
            padding = max(2, int(min(w, h) * PADDING_RATIO)
            roi = img[max(0,y-padding):min(img.shape[0],y+h+padding),
                     max(0,x-padding):min(img.shape[1],x+w+padding)]
            
            if roi.size == 0:
                continue
                
            element = {
                'type': classify_element(roi, aspect_ratio, w, h),
                'position': (x, y, w, h),
                'text': extract_text(roi),
                'color': get_dominant_color(roi),
                'area': area
            }
            
            # Additional validation
            if element['type'] == 'button' and h < MIN_BUTTON_HEIGHT:
                element['type'] = 'unknown'
            elif element['type'] == 'input_field' and h < MIN_INPUT_HEIGHT:
                element['type'] = 'unknown'
                
            if element['type'] != 'unknown':
                elements.append(element)
                color = (0, 255, 0) if element['type'] == 'button' else (255, 0, 0)
                cv2.rectangle(debug_img, (x, y), (x+w, y+h), color, 2)
                
        except Exception as e:
            if DEBUG_MODE:
                print(f"Error processing contour: {str(e)}")
            continue
    
    if DEBUG_MODE:
        cv2.imwrite(os.path.join(OUTPUT_DIR, 'element_debug.png'), debug_img)
    return elements

def classify_element(roi, aspect_ratio, width, height):
    try:
        text = extract_text(roi)
        has_text = len(text.strip()) >= MIN_TEXT_LENGTH
        
        # Calculate fill percentage
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        fill_pct = cv2.countNonZero(binary) / (width * height)
        
        # Classification rules
        if has_text:
            if BUTTON_ASPECT_RATIO[0] <= aspect_ratio <= BUTTON_ASPECT_RATIO[1]:
                if fill_pct > 0.3:  # Buttons typically have solid fill
                    return 'button'
                return 'label'
            if INPUT_ASPECT_RATIO[0] <= aspect_ratio <= INPUT_ASPECT_RATIO[1]:
                return 'input_field'
        
        return 'unknown'
    except:
        return 'unknown'

def extract_text(roi):
    try:
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=30)
        thresh = cv2.adaptiveThreshold(gray, 255,
                                     cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                     cv2.THRESH_BINARY_INV,
                                     ADAPTIVE_BLOCK_SIZE,
                                     ADAPTIVE_C)
        text = pytesseract.image_to_string(thresh, config=TESSERACT_CONFIG)
        return text.strip()
    except:
        return ""

def get_dominant_color(roi):
    try:
        pixels = roi.reshape(-1, 3).astype(np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        _, labels, palette = cv2.kmeans(pixels, 1, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
        return palette[0].astype(int).tolist()
    except:
        return [0, 0, 0]
