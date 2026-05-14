# 猫咪精灵图 AI 生成提示词

## 通用参数（所有图片共用）

### Stable Diffusion
```
正面提示词前缀:
  A cute orange tabby cat, cartoon style, soft shading, clean edges, white background, 
  full body view, consistent proportions, high quality, masterpiece

负面提示词:
  realistic, photograph, 3d render, blurry, deformed, extra limbs, bad anatomy, 
  watermark, text, signature, low quality, worst quality, duplicate

参数:
  Steps: 30-40
  CFG Scale: 7-8
  Sampler: DPM++ 2M Karras
  Size: 512x512（生成后裁剪为 256x256 或按需裁剪）
  Seed: 固定一个种子，所有图用同一种子保持一致性
```

### Midjourney
```
通用后缀:
  --style cute --ar 1:1 --s 250 --seed 12345
  （用同一个 --seed 保持风格一致）
```

---

## 各姿态提示词

### 1. idle_1.png / idle_2.png - 站立
```
SD: A cute orange tabby cat standing upright, looking forward with curious green eyes, 
    tail slightly raised, relaxed pose, cartoon style, white background
    [帧2: tail swaying to the side]

MJ: cute orange tabby cat standing, curious expression, tail up, cartoon illustration, 
    white background --ar 1:1 --seed 12345
```

### 2. walk_1.png / walk_2.png - 行走
```
SD: A cute orange tabby cat walking, mid-step with front left paw forward, 
    body slightly stretched, tail balanced behind, cartoon style, white background
    [帧2: front right paw forward, opposite leg position]

MJ: cute orange tabby cat walking, mid-stride pose, cartoon illustration, 
    white background --ar 1:1 --seed 12345
```

### 3. sit_1.png / sit_2.png - 坐下
```
SD: A cute orange tabby cat sitting down, front paws together, looking upward with 
    big green eyes, tail wrapped around body, cartoon style, white background
    [帧2: looking slightly downward]

MJ: cute orange tabby cat sitting, looking up, adorable expression, cartoon illustration, 
    white background --ar 1:1 --seed 12345
```

### 4. sleep_1.png / sleep_2.png - 睡觉
```
SD: A cute orange tabby cat curled up sleeping, eyes closed, peaceful expression, 
    tail wrapped around body, compact round shape, cartoon style, white background
    [帧2: same pose, body slightly expanded as if breathing in]

MJ: cute orange tabby cat sleeping curled up, eyes closed, cozy, cartoon illustration, 
    white background --ar 4:3 --seed 12345
```

### 5. pounce_1.png / pounce_2.png - 扑抓
```
SD: A cute orange tabby cat in pouncing position, crouched low with hind legs bent, 
    front paws forward, intense focused eyes, fur slightly puffed, cartoon style, white background
    [帧2: mid-air pounce, body extended forward, front paws reaching out]

MJ: cute orange tabby cat pouncing, crouched ready to jump, intense look, cartoon illustration, 
    white background --ar 1:1 --seed 12345
```

### 6. groom_1.png / groom_2.png - 舔毛
```
SD: A cute orange tabby cat sitting and grooming, one front paw raised to mouth, 
    licking paw, half-closed eyes content expression, cartoon style, white background
    [帧2: other paw raised, different grooming angle]

MJ: cute orange tabby cat grooming, licking paw, content expression, cartoon illustration, 
    white background --ar 1:1 --seed 12345
```

### 7. stretch_1.png - 伸懒腰
```
SD: A cute orange tabby cat stretching, front paws extended forward on ground, 
    back arched up, yawning with mouth open, cartoon style, white background

MJ: cute orange tabby cat stretching, front paws forward, back arched, yawning, 
    cartoon illustration, white background --ar 3:2 --seed 12345
```

### 8. stalk_1.png / stalk_2.png - 蹲伏潜行
```
SD: A cute orange tabby cat in stalking position, body low to ground, belly almost touching, 
    wide alert eyes, tail low, sneaky expression, cartoon style, white background
    [帧2: slightly forward, one paw reaching ahead]

MJ: cute orange tabby cat stalking low to ground, sneaky expression, cartoon illustration, 
    white background --ar 2:1 --seed 12345
```

### 9. paw_1.png / paw_2.png - 爪拍
```
SD: A cute orange tabby cat reaching one front paw forward to bat at something, 
    playful expression, other paw on ground, cartoon style, white background
    [帧2: paw extended further, reaching down]

MJ: cute orange tabby cat reaching paw forward playfully, cartoon illustration, 
    white background --ar 1:1 --seed 12345
```

### 10. happy_1.png / happy_2.png - 高兴蹭蹭
```
SD: A cute orange tabby cat with happy squinting eyes, body leaning to one side, 
    rubbing cheek against something, content purring expression, cartoon style, white background
    [帧2: leaning to other side, same happy expression]

MJ: cute orange tabby cat happy, squinting eyes, rubbing cheek, purring, cartoon illustration, 
    white background --ar 1:1 --seed 12345
```

### 11. poof_1.png / poof_2.png - 炸毛
```
SD: A cute orange tabby cat with fur standing on end, arched back, puffed tail, 
    wide scared eyes, defensive startled pose, cartoon style, white background
    [帧2: same but slightly more expanded fur]

MJ: cute orange tabby cat startled, fur puffed up, arched back, scared eyes, cartoon illustration, 
    white background --ar 1:1 --seed 12345
```

### 12. angry_1.png / angry_2.png - 生气甩尾
```
SD: A cute orange tabby cat with angry expression, narrowed eyes, ears flattened back, 
    tail raised and swishing, annoyed pose, cartoon style, white background
    [帧2: tail swished to other side]

MJ: cute orange tabby cat angry, flattened ears, swishing tail, annoyed expression, 
    cartoon illustration, white background --ar 1:1 --seed 12345
```

### 13. sad_1.png - 委屈
```
SD: A cute orange tabby cat looking sad, hunched body, big watery eyes, 
    ears drooping, small teardrop, pitiful expression, cartoon style, white background

MJ: cute orange tabby cat sad, droopy ears, watery eyes, pitiful expression, 
    cartoon illustration, white background --ar 1:1 --seed 12345
```

### 14. zoom_1.png - 跑酷冲刺
```
SD: A cute orange tabby cat running at full speed, body stretched horizontally, 
    all four paws off ground, determined expression, motion blur lines, 
    cartoon style, white background

MJ: cute orange tabby cat running fast, stretched body, all paws off ground, 
    cartoon illustration, white background --ar 3:2 --seed 12345
```

### 15. dead_1.png / dead_2.png - 装死
```
SD: A cute orange tabby cat lying on back, four paws in air, belly exposed, 
    eyes closed with one eye slightly peeking open, cartoon style, white background
    [帧2: both eyes peeking open sneakily]

MJ: cute orange tabby cat lying on back, paws up, peeking one eye open, 
    cartoon illustration, white background --ar 3:2 --seed 12345
```

### 16. howl_1.png - 夜间嚎叫
```
SD: A cute orange tabby cat sitting and howling, head tilted up toward sky, 
    mouth open wide, small crescent moon in background, cartoon style, white background

MJ: cute orange tabby cat howling at moon, head up, mouth open, 
    cartoon illustration, white background --ar 1:1 --seed 12345
```

### 17. doze_1.png / doze_2.png - 打盹
```
SD: A cute orange tabby cat sitting and dozing off, head nodding down, 
    droopy closed eyes, small zzz floating, cartoon style, white background
    [帧2: head slightly up, one eye half open, startled awake]

MJ: cute orange tabby cat dozing off, head nodding, sleepy expression, 
    cartoon illustration, white background --ar 1:1 --seed 12345
```

### 18. keyboard_1.png / keyboard_2.png - 踩键盘
```
SD: A cute orange tabby cat sitting on a keyboard, front paws on keys, 
    happy mischievous expression, cartoon style, white background
    [帧2: one paw pressing a key down]

MJ: cute orange tabby cat sitting on keyboard, paws on keys, playful expression, 
    cartoon illustration, white background --ar 1:1 --seed 12345
```

### 19. taskbar_1.png - 蹲任务栏
```
SD: A cute orange tabby cat sitting compactly, front paws tucked in, 
    alert watching expression, small size, cartoon style, white background

MJ: cute orange tabby cat sitting small and compact, watching alertly, 
    cartoon illustration, white background --ar 2:1 --seed 12345
```

### 20. scratch_1.png / scratch_2.png - 扒窗口
```
SD: A cute orange tabby cat standing on hind legs, front paws scratching at 
    a surface, reaching up, cartoon style, white background
    [帧2: paws slightly different position, scratching motion]

MJ: cute orange tabby cat standing on hind legs, paws scratching upward, 
    cartoon illustration, white background --ar 1:1 --seed 12345
```

### 21. stare_1.png - 看窗外
```
SD: A cute orange tabby cat sitting and staring into distance, thoughtful expression, 
    looking to the side, tail wrapped, cartoon style, white background

MJ: cute orange tabby cat staring into distance, thoughtful, looking sideways, 
    cartoon illustration, white background --ar 1:1 --seed 12345
```

### 22. block_1.png - 挡屏幕
```
SD: A cute orange tabby cat lying down spread out, belly flat on ground, 
    front paws extended, blocking view, drowsy expression, cartoon style, white background

MJ: cute orange tabby cat lying flat on ground, spread out blocking, sleepy, 
    cartoon illustration, white background --ar 2:1 --seed 12345
```

### 23. bug_1.png / bug_2.png - 抓虫子
```
SD: A cute orange tabby cat crouching and pawing at a small bug on the ground, 
    focused curious eyes, front paw reaching down, cartoon style, white background
    [帧2: paw swiping at the bug]

MJ: cute orange tabby cat pawing at a small bug, curious focused expression, 
    cartoon illustration, white background --ar 1:1 --seed 12345
```

### 24. spin_1~4.png - 追尾巴/转圈
```
SD: A cute orange tabby cat turning around chasing its own tail, body curved, 
    looking back at tail, cartoon style, white background
    [帧2-4: different rotation angles of the same chase]

MJ: cute orange tabby cat chasing its own tail, turning around, playful, 
    cartoon illustration, white background --ar 1:1 --seed 12345
```

### 25. cup_1.png / cup_2.png - 打翻杯子
```
SD: A cute orange tabby cat pushing a cup with one paw, mischievous expression, 
    cup tipping over, cartoon style, white background
    [帧2: cup falling, cat watching it fall]

MJ: cute orange tabby cat pushing a cup off table, mischievous expression, 
    cartoon illustration, white background --ar 1:1 --seed 12345
```

---

## 文件命名规范

所有文件放在 `assets/cat/` 目录下：
- 格式：PNG，透明背景
- 命名：`{状态名}_{帧号}.png`，帧号从1开始
- 尺寸：建议 256x256 或 512x512（代码会自动缩放）
- 最少每个状态1张，推荐2张

## 快速生成步骤

1. 选一个 AI 工具（Midjourney / Stable Diffusion / DALL-E）
2. 用上面的提示词生成，**保持同一个 seed**
3. 去背景（用 remove.bg 或 Photoshop 魔棒工具）
4. 裁剪为正方形，保留透明背景
5. 按命名规范保存到 `assets/cat/`
6. 重新运行 `python main.py`，自动加载图片版本
