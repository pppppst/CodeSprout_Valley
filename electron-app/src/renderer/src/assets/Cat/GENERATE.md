# GPT Image 2 精灵图生成指南

## 生成方式
**一次性生成一整张精灵图大图，然后手动裁剪为单独的 PNG 文件。**

---

## 提示词

直接复制以下提示词发给 GPT Image 2（ChatGPT 中选择 "GPT Image 2" 模型）：

---

```
Create a professional 2D game sprite sheet of ONE cute orange tabby cat, 
showing all its poses and actions in a clean grid layout.

STYLE: Cartoon illustration, soft cel-shading, warm orange fur with white chest 
and paws, big expressive green eyes, pink nose, consistent proportions throughout. 
Simple clean background (pure white). Each frame should look like it belongs to 
the same character in the same art style - NO style variation between frames.

LAYOUT: 8 columns × 6 rows grid, evenly spaced, with thin light gray grid lines 
between frames. Each cell is square. Label each row with a small number in the 
top-left corner (R1, R2, ... R6) for reference.

ROW 1 - IDLE & WALK (4 frames each for smooth loop):
  R1-C1: Standing still, looking forward, tail relaxed down, neutral happy face
  R1-C2: Standing, tail slightly swayed right, same neutral face  
  R1-C3: Walking, left front paw forward, right back paw back, balanced body
  R1-C4: Walking, right front paw forward, left back paw back, opposite stride

ROW 2 - SIT & SLEEP (4 frames each):
  R2-C1: Sitting upright, front paws together, looking up with curious eyes, tail wrapped
  R2-C2: Sitting, looking slightly down at ground, same composed pose
  R2-C3: Curled up sleeping, eyes closed, peaceful face, tail wrapped tight, compact round shape
  R2-C4: Same sleep pose but body slightly expanded (breathing in), subtle difference

ROW 3 - POUNCE & CROUCH (4 frames):
  R3-C1: Crouching low, hind legs bent, front paws on ground, intense focused eyes, ready to spring
  R3-C2: Mid-pounce, body fully extended in air, front paws reaching forward, determined face
  R3-C3: Landing from pounce, front paws touching ground, body compressed from impact
  R3-C4: Back to relaxed standing, looking satisfied after pounce

ROW 4 - GROOM & STRETCH (3-4 frames):
  R4-C1: Sitting, one front paw raised to mouth, licking paw, content half-closed eyes
  R4-C2: Same grooming, other paw raised, different angle
  R4-C3: Stretching forward, front paws extended flat on ground, back arched high, yawning mouth open
  R4-C4: Stretching, back still arched, mouth closing from yawn, eyes squinting

ROW 5 - STALK & PAW TAP (3 frames each):
  R5-C1: Belly-crawling, body very low to ground, wide alert eyes, sneaky expression
  R5-C2: Stalking, one paw reaching forward cautiously, still low
  R5-C3: Stalking, other paw forward, advancing
  R5-C4: Reaching one front paw out to bat/tap something, playful curious face

ROW 6 - SPECIAL POSES (4 frames):
  R6-C1: Lying flat on belly, spread out, blocking, drowsy eyes (playing dead / blocking screen)
  R6-C2: Same flat pose, one eye peeking open sneakily (playing dead variant)
  R6-C3: On back, four paws in air, belly exposed, eyes closed (play dead upside down)
  R6-C4: Same on-back pose, one eye cracking open to peek

ROW 7 - EMOTIONS: HAPPY & SCARED (3 frames each):
  R7-C1: Happy squinting eyes, body leaning left, rubbing cheek, purring expression
  R7-C2: Happy, body leaning right, same content face, nuzzling
  R7-C3: Fur standing on end everywhere, arched back, puffed tail, wide scared eyes, startled
  R7-C4: Same scared pose, even more fur puffed, defensive crouch

ROW 8 - EMOTIONS: ANGRY & SAD (3 frames each):
  R8-C1: Angry face, narrowed eyes, ears flattened back, tail raised and swished right
  R8-C2: Angry, tail swished to left, same annoyed expression
  R8-C3: Sad, hunched body, big watery eyes, ears drooping down, small tear drop
  R8-C4: Sad, same pitiful face, curled up smaller, more pathetic

ROW 9 - ACTIONS: RUNNING & CATCHING (4 frames):
  R9-C1: Full speed running, body stretched horizontal, all paws off ground, determined face, motion lines
  R9-C2: Running, different leg position, same speed
  R9-C3: Crouching and pawing at small bug on ground, focused curious eyes
  R9-C4: Paw swiping at the bug, playful excited expression

ROW 10 - ACTIONS: HOWL & CHASE (4 frames):
  R10-C1: Sitting, head tilted up to sky, mouth wide open howling, small crescent moon visible
  R10-C2: Howling, mouth slightly different shape, eyes closed with effort
  R10-C3: Turning to chase own tail, body curved, looking back at tail
  R10-C4: Same tail chase, body turned further, tail visible on other side

ROW 11 - MISC: DOZE & INTERACT (4 frames):
  R11-C1: Sitting, dozing off, head nodding down, droopy closed eyes, small "zzz"
  R11-C2: Dozing, head bobbed back up, one eye half open, startled then sleepy again
  R11-C3: Reaching paw to push a small cup, mischievous grin
  R11-C4: Cup tipping over, cat watching it fall with satisfied expression

ROW 12 - ENVIRONMENT (4 frames):
  R12-C1: Sitting on keyboard, paws on keys, happy oblivious face
  R12-C2: Standing on hind legs, front paws scratching upward at surface
  R12-C3: Sitting and staring into distance to the side, thoughtful dreamy expression
  R12-C4: Sitting compact and alert, watching something intently, small posture

TOTAL: 48 frames showing a complete range of cat emotions and actions.
Each frame should be clearly separated. The cat must look EXACTLY THE SAME 
in every frame - same orange color, same proportions, same eye color, same style.
This is a sprite sheet for a desktop pet game.
```

---

## 裁剪说明

生成后，将大图按 8×6 网格裁剪为 48 个小图，然后重命名：

| 位置 | 文件名 | 用途 |
|------|--------|------|
| R1-C1 | `idle_1.png` | 站立 |
| R1-C2 | `idle_2.png` | 站立（尾巴摆） |
| R1-C3 | `walk_1.png` | 行走左脚 |
| R1-C4 | `walk_2.png` | 行走右脚 |
| R2-C1 | `sit_1.png` | 坐下看上方 |
| R2-C2 | `sit_2.png` | 坐下看下方 |
| R2-C3 | `sleep_1.png` | 睡觉 |
| R2-C4 | `sleep_2.png` | 睡觉（呼吸） |
| R3-C1 | `pounce_1.png` | 弓背蓄力 |
| R3-C2 | `pounce_2.png` | 腾空扑出 |
| R3-C3 | `pounce_3.png` | 落地 |
| R3-C4 | `pounce_4.png` | 恢复站立 |
| R4-C1 | `groom_1.png` | 舔左爪 |
| R4-C2 | `groom_2.png` | 舔右爪 |
| R4-C3 | `stretch_1.png` | 伸懒腰弓背 |
| R4-C4 | `stretch_2.png` | 伸懒腰收起 |
| R5-C1 | `stalk_1.png` | 潜伏1 |
| R5-C2 | `stalk_2.png` | 潜伏2 |
| R5-C3 | `stalk_3.png` | 潜伏3 |
| R5-C4 | `paw_1.png` | 爪拍 |
| R6-C1 | `block_1.png` | 趴下挡屏 |
| R6-C2 | `dead_1.png` | 装死偷看 |
| R6-C3 | `dead_2.png` | 装死仰躺 |
| R6-C4 | `dead_3.png` | 装死偷看2 |
| R7-C1 | `happy_1.png` | 高兴蹭左 |
| R7-C2 | `happy_2.png` | 高兴蹭右 |
| R7-C3 | `poof_1.png` | 炸毛1 |
| R7-C4 | `poof_2.png` | 炸毛2 |
| R8-C1 | `angry_1.png` | 生气甩尾左 |
| R8-C2 | `angry_2.png` | 生气甩尾右 |
| R8-C3 | `sad_1.png` | 委屈1 |
| R8-C4 | `sad_2.png` | 委屈2 |
| R9-C1 | `zoom_1.png` | 跑酷1 |
| R9-C2 | `zoom_2.png` | 跑酷2 |
| R9-C3 | `bug_1.png` | 抓虫1 |
| R9-C4 | `bug_2.png` | 抓虫2 |
| R10-C1 | `howl_1.png` | 嚎叫1 |
| R10-C2 | `howl_2.png` | 嚎叫2 |
| R10-C3 | `spin_1.png` | 追尾巴1 |
| R10-C4 | `spin_2.png` | 追尾巴2 |
| R11-C1 | `doze_1.png` | 打盹1 |
| R11-C2 | `doze_2.png` | 打盹2 |
| R11-C3 | `cup_1.png` | 推杯子1 |
| R11-C4 | `cup_2.png` | 推杯子2 |
| R12-C1 | `keyboard_1.png` | 踩键盘 |
| R12-C2 | `scratch_1.png` | 扒窗口 |
| R12-C3 | `stare_1.png` | 看窗外 |
| R12-C4 | `taskbar_1.png` | 蹲守 |

## 裁剪工具推荐

- **在线**: https://www.splitimage.kaser.dev/ （按行列数分割）
- **Python脚本**: 下面提供自动裁剪脚本

```python
# crop_sprites.py - 自动裁剪精灵图
from PIL import Image
import os

img = Image.open("sprite_sheet.png")
cols, rows = 8, 6
w, h = img.size[0] // cols, img.size[1] // rows

names = [
    ["idle_1","idle_2","walk_1","walk_2","sit_1","sit_2","sleep_1","sleep_2"],
    ["pounce_1","pounce_2","pounce_3","pounce_4","groom_1","groom_2","stretch_1","stretch_2"],
    ["stalk_1","stalk_2","stalk_3","paw_1","block_1","dead_1","dead_2","dead_3"],
    ["happy_1","happy_2","poof_1","poof_2","angry_1","angry_2","sad_1","sad_2"],
    ["zoom_1","zoom_2","bug_1","bug_2","howl_1","howl_2","spin_1","spin_2"],
    ["doze_1","doze_2","cup_1","cup_2","keyboard_1","scratch_1","stare_1","taskbar_1"],
]

os.makedirs("assets/cat", exist_ok=True)
for r in range(rows):
    for c in range(cols):
        crop = img.crop((c*w, r*h, (c+1)*w, (r+1)*h))
        crop.save(f"assets/cat/{names[r][c]}.png")
print("Done! 48 sprites saved to assets/cat/")
```

## 生成后

将裁剪好的 PNG 文件放入 `assets/cat/` 目录，运行 `python main.py` 即可自动加载图片版本。
