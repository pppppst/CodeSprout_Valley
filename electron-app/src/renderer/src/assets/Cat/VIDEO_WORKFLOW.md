# AI视频生成猫咪精灵图 - 完整工作流

## 核心思路

```
关键姿态图(GPT Image 2) → 视频生成(Runway/Kling) → 提取帧(FFmpeg) → 精灵图
```

每段视频 2-4 秒，提取 8-16 帧，动作极其流畅。

---

## 第一步：生成关键姿态图（6张）

用 ChatGPT GPT Image 2 生成，要求**同一角色、同一风格**。

### 提示词（一次性生成全部6张，或分6次生成保持一致性）

```
Generate 6 images of the SAME cute orange tabby cat in 6 different poses. 
The cat must look IDENTICAL in all images - same orange fur with white chest 
and paws, same big green eyes, same pink nose, same proportions, same cartoon 
illustration style with soft shading.

Each image: clean white background, full body visible, centered in frame, 
high resolution, game sprite quality.

The 6 poses are:
1. STANDING - cat standing normally, looking forward, relaxed, tail down
2. WALKING - cat mid-walk, one paw forward, body slightly leaning
3. SLEEPING - cat curled up in a ball, eyes closed, peaceful
4. POUNCING - cat crouched low, ready to spring, intense eyes
5. SITTING - cat sitting upright, paws together, looking up
6. PLAYING - cat on back, paws in air, playful expression

Please generate each one separately but maintain perfect character consistency.
```

**重要**：如果分多次生成，在每张图的提示词开头加上：
```
Use the exact same cat character as before: orange tabby, white chest, 
green eyes, cartoon style, soft shading.
```

---

## 第二步：生成过渡视频（10段）

每段视频描述一个动作的**起止过程**，时长 2-3 秒。

### 推荐工具（按效果排序）

| 工具 | 特点 | 适合 |
|------|------|------|
| **Runway Gen-4** | 质量最高，动作最自然 | 首选 |
| **Kling 1.6** | 角色一致性强 | 备选 |
| **Pika 2.0** | 简单易用 | 快速测试 |
| **Luma Ray** | 免费额度多 | 预算有限 |

### 视频提示词（共10段）

---

#### V1: 站立待机 → 行走（循环动画）

**起始帧**: 用「站立」图
**结束帧**: 用「行走」图（或同一起始帧）

```
A cute orange tabby cat standing still, then starts walking slowly to the right. 
Smooth natural cat walk cycle, paws moving alternately, tail gently swaying. 
The cat takes 3-4 steps. Camera follows horizontally. White background. 
Cartoon illustration style. 2 seconds, smooth 24fps.
```

**提取**: 取中间完整步态循环的 4 帧 → `walk_1~4.png`

---

#### V2: 行走 → 站立停下

**起始帧**: 用「行走」图

```
A cute orange tabby cat walking, then slows down and stops, standing still. 
Natural deceleration, final paw placement, body straightens. 
White background. 1.5 seconds.
```

**提取**: 取停下过程的 2 帧 → `idle_1~2.png`

---

#### V3: 站立 → 坐下

**起始帧**: 用「站立」图

```
A cute orange tabby cat transitions from standing to sitting down. 
Hind legs fold under body, front paws come together, tail wraps around. 
Smooth fluid motion. White background. 2 seconds.
```

**提取**: 取坐下过程的 3 帧 → `sit_1~3.png`

---

#### V4: 坐下 → 蜷缩睡觉

**起始帧**: 用「坐下」图

```
A cute orange tabby cat sitting, then slowly curls up into a sleeping position. 
Body rounds out, head tucks down, eyes close, tail wraps around body. 
Peaceful, gentle motion. White background. 3 seconds.
```

**提取**: 取蜷缩过程 + 睡眠呼吸的 4 帧 → `sleep_1~4.png`

---

#### V5: 站立 → 弓背扑抓

**起始帧**: 用「站立」图

```
A cute orange tabby cat crouches down, body low, hind legs coil, then suddenly 
springs forward in a powerful pounce, front paws reaching out, body fully extended 
in the air. Dynamic action, energy burst. White background. 2 seconds.
```

**提取**: 取蓄力→腾空→落地的 6 帧 → `pounce_1~6.png`

---

#### V6: 站立 → 伸懒腰 → 舔毛

**起始帧**: 用「站立」图

```
A cute orange tabby cat stretches, front paws forward, back arched, yawning wide. 
Then relaxes and raises one paw to lick it, grooming. Content expression. 
White background. 3 seconds.
```

**提取**: 伸懒腰 2 帧 + 舔毛 4 帧 → `stretch_1~2.png`, `groom_1~4.png`

---

#### V7: 站立 → 潜伏 → 扑虫

**起始帧**: 用「站立」图

```
A cute orange tabby cat spots something on the ground, crouches low, stalks 
forward cautiously with belly near ground, then pounces at it with paw. 
Intense focus, playful hunting. White background. 3 seconds.
```

**提取**: 潜伏 3 帧 + 扑抓 3 帧 → `stalk_1~3.png`, `bug_1~3.png`

---

#### V8: 坐下 → 各种情绪

**起始帧**: 用「坐下」图

```
A cute orange tabby cat sitting, then shows different emotions in sequence: 
first happy squinting eyes and leaning to rub cheek, then suddenly startled 
with fur puffed up, then angry with flattened ears and swishing tail, 
then sad with droopy ears and watery eyes. 
Each emotion held for about 1 second. White background. 5 seconds.
```

**提取**: 每种情绪取 2 帧 → `happy_1~2.png`, `poof_1~2.png`, `angry_1~2.png`, `sad_1~2.png`

---

#### V9: 站立 → 跑酷冲刺 → 装死

**起始帧**: 用「站立」图

```
A cute orange tabby cat suddenly gets zoomies, races forward at full speed 
with body stretched out, all paws off ground, wild eyes. Then abruptly flops 
over on its back, four paws in the air, playing dead. One eye peeks open. 
White background. 4 seconds.
```

**提取**: 冲刺 3 帧 + 装死 3 帧 → `zoom_1~3.png`, `dead_1~3.png`

---

#### V10: 坐下 → 追尾巴 → 打盹

**起始帧**: 用「坐下」图

```
A cute orange tabby cat starts chasing its own tail, spinning in a circle, 
then gets dizzy, sits down, head nods down dozing off, then jerks back awake. 
Playful then sleepy. White background. 5 seconds.
```

**提取**: 追尾巴 4 帧 + 打盹 4 帧 → `spin_1~4.png`, `doze_1~4.png`

---

## 第三步：提取帧

### 安装 FFmpeg
```bash
# Windows (conda)
conda install -c conda-forge ffmpeg
# 或下载: https://ffmpeg.org/download.html
```

### 提取命令

```bash
# 每段视频提取帧（每秒8帧，适合游戏动画）
ffmpeg -i walk.mp4 -vf "fps=8" frames/walk_%02d.png
ffmpeg -i sleep.mp4 -vf "fps=8" frames/sleep_%02d.png
ffmpeg -i pounce.mp4 -vf "fps=8" frames/pounce_%02d.png
# ... 对每段视频重复
```

### 自动提取脚本

用下面的 `extract_frames.py` 自动处理所有视频。

---

## 第四步：组装精灵图

从提取的帧中挑选最佳的，重命名为规范文件名，放入 `assets/cat/`。

### 最终文件清单（建议 50+ 帧）

```
assets/cat/
├── idle_1.png ~ idle_4.png          # 站立循环（4帧）
├── walk_1.png ~ walk_6.png          # 行走循环（6帧）
├── sit_1.png ~ sit_3.png            # 坐下（3帧）
├── sleep_1.png ~ sleep_4.png        # 睡觉呼吸（4帧）
├── pounce_1.png ~ pounce_6.png      # 扑抓全流程（6帧）
├── groom_1.png ~ groom_4.png        # 舔毛（4帧）
├── stretch_1.png ~ stretch_2.png    # 伸懒腰（2帧）
├── stalk_1.png ~ stalk_3.png        # 潜伏（3帧）
├── bug_1.png ~ bug_3.png            # 抓虫（3帧）
├── happy_1.png ~ happy_2.png        # 高兴（2帧）
├── poof_1.png ~ poof_2.png          # 炸毛（2帧）
├── angry_1.png ~ angry_2.png        # 生气（2帧）
├── sad_1.png ~ sad_2.png            # 委屈（2帧）
├── zoom_1.png ~ zoom_3.png          # 跑酷（3帧）
├── dead_1.png ~ dead_3.png          # 装死（3帧）
├── spin_1.png ~ spin_4.png          # 追尾巴（4帧）
├── doze_1.png ~ doze_4.png          # 打盹（4帧）
├── howl_1.png ~ howl_2.png          # 嚎叫（2帧）
├── cup_1.png ~ cup_2.png            # 推杯子（2帧）
├── keyboard_1.png ~ keyboard_2.png  # 踩键盘（2帧）
├── scratch_1.png ~ scratch_2.png    # 扒窗（2帧）
├── stare_1.png                      # 看窗外
├── taskbar_1.png                    # 蹲守
├── block_1.png                      # 挡屏幕
└── paw_1.png ~ paw_2.png           # 爪拍（2帧）
```

总计约 **65 帧**，每帧都是 AI 视频提取的高清连贯画面。

---

## GPT Image 2 角色一致性技巧

如果分多次生成，每次提示词开头加上这段「角色锚定」：

```
CHARACTER REFERENCE - This is the EXACT same cat from previous images:
- Orange tabby fur, slightly darker orange stripes
- White chest, belly, and paw tips
- Large round green eyes with black pupils  
- Small pink triangular nose
- Medium-long fluffy fur
- Cartoon illustration style with soft cel-shading
- Proportions: head is slightly large for body (cute chibi style)
- About 3 heads tall total body height
```

---

## 时间估算

| 步骤 | 工具 | 时间 |
|------|------|------|
| 生成6张关键图 | GPT Image 2 | 15分钟 |
| 生成10段视频 | Runway/Kling | 30-60分钟 |
| 提取帧 | FFmpeg脚本 | 5分钟 |
| 挑选+重命名 | 手动 | 15分钟 |
| **总计** | | **约1-2小时** |
