import cv2
from config import *

def load_image(filename):
    img_path = os.path.join(INPUT_DIR, filename)
    img = cv2.imread(img_path)
    if img is None:
        raise FileNotFoundError(f"Image not found at {img_path}")
    return img

def preprocess_image(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP_LIMIT, tileGridSize=CLAHE_GRID_SIZE)
    enhanced = clahe.apply(gray)
    
    thresh = cv2.adaptiveThreshold(enhanced, 255,
                                 cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                 cv2.THRESH_BINARY_INV,
                                 ADAPTIVE_BLOCK_SIZE,
                                 ADAPTIVE_C)
    
    if DEBUG_MODE:
        cv2.imwrite(os.path.join(OUTPUT_DIR, 'threshold.png'), thresh)
    return thresh

def save_detection_image(img, elements):
    output = img.copy()
    for elem in elements:
        x,y,w,h = elem['position']
        color = (0,255,0) if elem['type'] == 'button' else (255,0,0)
        cv2.rectangle(output, (x,y), (x+w,y+h), color, 2)
        cv2.putText(output, f"{elem['type']}:{elem['text']}", (x,y-5), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255,255,255), 1)
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'detected.png'), output)
