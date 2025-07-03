from image_processor import *
from element_detector import detect_elements
import os

def generate_html(elements):
    html = """<!DOCTYPE html>
<html>
<head>
    <title>Generated UI</title>
    <style>
        body { 
            font-family: Arial, sans-serif;
            position: relative;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
        }
        .ui-element {
            position: absolute;
            box-sizing: border-box;
        }
    </style>
</head>
<body>"""
    
    for elem in elements:
        x, y, w, h = elem['position']
        r, g, b = elem['color']
        text = elem['text']
        
        if elem['type'] == 'button':
            html += f"""
    <button class="ui-element" style="
        left: {x}px; top: {y}px;
        width: {w}px; height: {h}px;
        background: rgb({r},{g},{b});
        color: {'white' if (r+g+b) < 450 else 'black'};
        border: none;
        border-radius: 4px;
        padding: 5px;
    ">{text}</button>"""
        elif elem['type'] == 'input_field':
            html += f"""
    <input class="ui-element" type="text" style="
        left: {x}px; top: {y}px;
        width: {w}px; height: {h}px;
        background: white;
        border: 1px solid rgb({r},{g},{b});
        padding: 5px;
    " value="{text}">"""
    
    html += """
</body>
</html>"""
    
    output_path = os.path.join(OUTPUT_DIR, 'index.html')
    with open(output_path, 'w') as f:
        f.write(html)
    return output_path

def main():
    print("="*50)
    print("UI to HTML Converter")
    print("="*50)
    
    try:
        # Load and process image
        img = load_image("ui_screenshot.png")
        thresh = preprocess_image(img)
        
        # Detect elements
        elements = detect_elements(img, thresh)
        print(f"\nDetected {len(elements)} elements:")
        for elem in elements:
            print(f"- {elem['type']} at {elem['position']} (Text: '{elem['text']}')")
        
        # Generate outputs
        save_detection_image(img, elements)
        html_path = generate_html(elements)
        
        print("\nConversion successful!")
        print(f"HTML saved to: {html_path}")
        print(f"Detection viz: {os.path.join(OUTPUT_DIR, 'detected.png')}")
        
    except Exception as e:
        print(f"\nError: {str(e)}")
        if DEBUG_MODE:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    main()
