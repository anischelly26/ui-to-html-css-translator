from config import OUTPUT_DIR
import os

def generate_html(elements):
    """Convert elements to HTML"""
    html = """<!DOCTYPE html>
<html>
<head>
    <title>Generated UI</title>
    <style>
        body { font-family: Arial; margin: 0; }
        .container { position: relative; min-height: 100vh; }
    </style>
</head>
<body>
    <div class="container">\n"""
    
    for elem in elements:
        x, y, w, h = elem['position']
        r, g, b = elem['color']
        
        if elem['type'] == 'button':
            html += f"""        <button style="position: absolute; left: {x}px; top: {y}px; 
            width: {w}px; height: {h}px; background: rgb({r},{g},{b}); border: none;
            {'color: white;' if sum([r,g,b]) < 382 else ''}">
            {elem['text']}</button>\n"""
            
        elif elem['type'] == 'input':
            html += f"""        <input type="text" style="position: absolute; left: {x}px; 
            top: {y}px; width: {w}px; height: {h}px; padding: 4px; border: 1px solid #ccc;"
            placeholder="{elem['text'] or 'Enter text'}">\n"""
    
    html += """    </div>
</body>
</html>"""
    
    output_path = os.path.join(OUTPUT_DIR, "index.html")
    with open(output_path, 'w') as f:
        f.write(html)
    
    return output_path
