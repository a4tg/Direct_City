import sys,json
from PIL import Image
source,target=sys.argv[1:3]
im=Image.open(source).convert("RGBA")
original=im.size
bounds=im.getchannel("A").getbbox()
if not bounds: raise ValueError("Пустое изображение здания")
pad=max(4,round(max(original)*.008))
crop=(max(0,bounds[0]-pad),max(0,bounds[1]-pad),min(im.width,bounds[2]+pad),min(im.height,bounds[3]+pad))
im=im.crop(crop)
geometry=im.size
im.thumbnail((768,768),Image.Resampling.LANCZOS)
im.save(target,"WEBP",quality=91,method=6)
print(json.dumps(dict(width=geometry[0],height=geometry[1],sourceWidth=original[0],sourceHeight=original[1],crop=list(crop),alphaBounds=list(bounds),renderWidth=im.width,renderHeight=im.height)))
