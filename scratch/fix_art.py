import re

file_path = '/Volumes/GameDrive/insaterrarium/src/art.ts'
with open(file_path, 'r') as f:
    content = f.read()

# Fix the texture names:
# g.generateTexture(, cw, ch); -> g.generateTexture(`bird_${key}_${stage}`, cw, ch);
# g.generateTexture(, cw, ch); -> g.generateTexture(`bird_${key}`, cw, ch);
# wwG.generateTexture(, wWidth, wHeight); -> wwG.generateTexture(`wing_${key}_${stage}`, wWidth, wHeight);
# wwG.generateTexture(, wWidth, wHeight); -> wwG.generateTexture(`wing_${key}`, wWidth, wHeight);

content = content.replace(
    '  g.generateTexture(, cw, ch);\n  if (stage === 2) {\n    g.generateTexture(, cw, ch);\n  }',
    '  g.generateTexture(`bird_${key}_${stage}`, cw, ch);\n  if (stage === 2) {\n    g.generateTexture(`bird_${key}`, cw, ch);\n  }'
)

content = content.replace(
    '  wwG.generateTexture(, wWidth, wHeight);\n  if (stage === 2) {\n    wwG.generateTexture(, wWidth, wHeight);\n  }',
    '  wwG.generateTexture(`wing_${key}_${stage}`, wWidth, wHeight);\n  if (stage === 2) {\n    wwG.generateTexture(`wing_${key}`, wWidth, wHeight);\n  }'
)

with open(file_path, 'w') as f:
    f.write(content)

print('Fixed art.ts texture string templates!')
