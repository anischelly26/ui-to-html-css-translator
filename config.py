import os

# ======================
# PATH CONFIGURATION
# ======================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TESSERACT_PATH = r'C:\Program Files\Tesseract-OCR\tesseract.exe'  # Update if installed elsewhere
INPUT_DIR = os.path.join(BASE_DIR, "input")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

# Create directories if they don't exist
os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ======================
# DETECTION PARAMETERS
# ======================
MIN_ELEMENT_AREA = 25        # Minimum pixels to consider as UI element
MAX_ELEMENT_AREA = 50000     # Maximum pixels to avoid false positives
BUTTON_ASPECT_RATIO = (1.2, 6.0)  # Width/height range for buttons
INPUT_ASPECT_RATIO = (2.5, 12.0)  # Width/height range for input fields
TEXT_CONFIDENCE = 35         # Minimum confidence for text recognition (0-100)
PADDING_RATIO = 0.15         # Padding around elements as percentage of size

# ======================
# IMAGE PROCESSING
# ======================
THRESHOLD_TYPE = 'adaptive'  # 'fixed' or 'adaptive'
ADAPTIVE_BLOCK_SIZE = 31     # Odd number, larger for bigger text
ADAPTIVE_C = 5               # Constant subtracted from mean
BLUR_KERNEL_SIZE = (3, 3)    # Gaussian blur kernel size
CLAHE_CLIP_LIMIT = 3.0       # Contrast enhancement limit (1.0-4.0)
CLAHE_GRID_SIZE = (8, 8)     # Contrast enhancement grid size

# ======================
# TEXT PROCESSING
# ======================
TESSERACT_CONFIG = r'--oem 3 --psm 7'  # OCR engine mode 3, page segmentation mode 7
TEXT_WHITELIST = r'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=[]{}|;:,.<>?/'

# ======================
# DEBUG SETTINGS
# ======================
DEBUG_MODE = True            # Saves intermediate processing images
SHOW_STEPS = False           # Displays processing steps in real-time

# ======================
# VALIDATION
# ======================
def validate_config():
    """Validate configuration parameters"""
    if not os.path.exists(TESSERACT_PATH):
        raise FileNotFoundError(f"Tesseract not found at {TESSERACT_PATH}")
    if not isinstance(BUTTON_ASPECT_RATIO, (tuple, list)) or len(BUTTON_ASPECT_RATIO) != 2:
        raise ValueError("BUTTON_ASPECT_RATIO must be a (min, max) tuple")
    if not isinstance(INPUT_ASPECT_RATIO, (tuple, list)) or len(INPUT_ASPECT_RATIO) != 2:
        raise ValueError("INPUT_ASPECT_RATIO must be a (min, max) tuple")

validate_config()
