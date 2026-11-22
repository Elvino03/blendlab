const canvas = document.querySelector("#blender");
const pen = canvas.getContext("2d");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function shape(points, color, outline, lineWidth = 1) {
  pen.beginPath();
  points.forEach(([x, y], index) => index ? pen.lineTo(x, y) : pen.moveTo(x, y));
  pen.closePath();
  if (color) {
    pen.fillStyle = color;
    pen.fill();
  }
  if (outline) {
    pen.strokeStyle = outline;
    pen.lineWidth = lineWidth;
    pen.stroke();
  }
}

function stroke(points, color, width = 1) {
  pen.beginPath();
  points.forEach(([x, y], index) => index ? pen.lineTo(x, y) : pen.moveTo(x, y));
  pen.strokeStyle = color;
  pen.lineWidth = width;
  pen.stroke();
}

function oval(x, y, rx, ry, fill, outline, width = 1) {
  pen.beginPath();
  pen.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) {
    pen.fillStyle = fill;
    pen.fill();
  }
  if (outline) {
    pen.strokeStyle = outline;
    pen.lineWidth = width;
    pen.stroke();
  }
}

function rounded(x, y, w, h, r, fill, outline) {
  pen.beginPath();
  pen.roundRect(x, y, w, h, r);
  pen.fillStyle = fill;
  pen.fill();
  if (outline) {
    pen.strokeStyle = outline;
    pen.lineWidth = 2;
    pen.stroke();
  }
}

function vertical(x, y1, y2, stops) {
  const gradient = pen.createLinearGradient(x, y1, x, y2);
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  return gradient;
}

function machineGuide() {
  pen.setLineDash([3, 6]);
  oval(320, 198, 164, 156, null, "#af722f");
  oval(320, 198, 192, 179, null, "#c68d37");
  pen.setLineDash([]);
  for (const side of [-1, 1]) {
    const x = 320 + side * 166;
    stroke([[x - 7, 198], [x + 7, 198]], "#96562b");
    stroke([[x, 191], [x, 205]], "#96562b");
  }
  stroke([[320, 24], [320, 37]], "#ac672d");
  stroke([[320, 362], [320, 376]], "#ac672d");
}

function artCard(picture, x, y, size, angle, horizontal = 1) {
  pen.save();
  pen.translate(x, y);
  pen.rotate(angle);
  pen.scale(horizontal, 1);
  const frame = size / 2;
  rounded(-frame - 4, -frame - 4, size + 8, size + 8, 5, "#fff0ba", "#381018");
  if (picture?.naturalWidth) {
    pen.fillStyle = "#ead8bd";
    pen.fillRect(-frame, -frame, size, size);
    const ratio = Math.min(size / picture.naturalWidth, size / picture.naturalHeight);
    const width = picture.naturalWidth * ratio;
    const height = picture.naturalHeight * ratio;
    pen.drawImage(picture, -width / 2, -height / 2, width, height);
  } else {
    const g = vertical(0, -frame, frame, [[0, "#d9363b"], [1, "#dfaa34"]]);
    pen.fillStyle = g;
    pen.fillRect(-frame, -frame, size, size);
    stroke([[-frame, frame - 4], [-1, -5], [frame, frame - 4]], "#fff0ba", 2);
  }
  pen.restore();
}

function easeBetween(start, end, progress) {
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function vortexPoint(depth, angle, scale) {
  const radius = (7 + 47 * (1 - depth)) * scale;
  const facing = Math.sin(angle);
  return {
    x: 309 - 7 * (1 - depth) * scale + radius * Math.cos(angle),
    y: 216 - 103 * (1 - depth) * scale + .32 * radius * facing,
    facing
  };
}

function drawVortex(picture, progress) {
  const turn = 2 * Math.PI;
  const phase = turn * progress * (1.7 + 1.55 * progress);
  const start = easeBetween(0, .32, progress);
  const settle = easeBetween(.72, 1, progress);
  const scale = (.72 + .28 * start) * (1 - .84 * settle);
  const strength = start * (1 - settle);
  const ribbons = [
    { offset: 0, width: 8, color: "#ff5b56" },
    { offset: .17, width: 2.4, color: "#ffafa0" },
    { offset: 2.6, width: 4, color: "#ffdb52" }
  ];

  pen.save();
  // Draw the back of each helix, the artwork inside it, then the front.
  for (const front of [false, true]) {
    for (const { offset, width, color } of ribbons) {
      pen.fillStyle = color;
      pen.globalAlpha = strength * (front ? .94 : .37);
      pen.beginPath();
      let previous;
      for (let i = 0; i <= 64; i += 1) {
        const depth = i / 64;
        const point = vortexPoint(depth, phase + offset + depth * turn * 2.2, scale);
        point.width = width * scale * (.26 + .74 * Math.sin(Math.PI * depth));
        if (previous && ((previous.facing + point.facing) >= 0) === front) {
          pen.moveTo(previous.x, previous.y - previous.width / 2);
          pen.lineTo(point.x, point.y - point.width / 2);
          pen.lineTo(point.x, point.y + point.width / 2);
          pen.lineTo(previous.x, previous.y + previous.width / 2);
          pen.closePath();
        }
        previous = point;
      }
      pen.fill();
    }

    if (!front && progress < .52) {
      const pull = easeBetween(0, .51, progress);
      const angle = phase + .75;
      pen.globalAlpha = 1 - easeBetween(.15, .52, progress);
      artCard(picture, 308 + Math.cos(angle) * 26 * pull, 165 + (35 + Math.sin(angle) * 12) * pull,
        54 - 33 * pull, -.19 + phase * .65, 1 - pull * (1 - Math.abs(Math.cos(angle))) * .6);
    }
  }

  // Small pieces of the original image follow the funnel as the card dissolves.
  if (picture?.naturalWidth) {
    const sw = picture.naturalWidth / 3;
    const sh = picture.naturalHeight / 2;
    const dissolve = easeBetween(.08, .39, progress);
    for (let i = 0; i < 6; i += 1) {
      const depth = (i / 6 + progress * .85) % 1;
      const angle = phase + depth * turn * 2.2 + .85 + .19 * i;
      const point = vortexPoint(depth, angle, scale);
      const size = (7 - depth * 4) * scale;
      pen.globalAlpha = strength * dissolve * Math.sin(Math.PI * depth) * (point.facing > 0 ? 1 : .45);
      pen.drawImage(picture, (i % 3) * sw, Math.floor(i / 3) * sh, sw, sh,
        point.x - size / 2, point.y - size / 2, size, size);
    }
  }
  pen.restore();
}

function drawMachine(picture, loaded = false, progress = null) {
  pen.clearRect(0, 0, canvas.width, canvas.height);
  machineGuide();
  const running = progress !== null;
  const activity = running ? Math.sin(Math.PI * progress) : 0;
  pen.save();
  pen.translate(activity * Math.sin(progress * 156) * .75, 1);
  pen.lineJoin = "round";
  pen.lineCap = "round";
  oval(324, 367, 131, 14, "#71342630");
  oval(323, 369, 103, 8, "#71342632");

  rounded(234, 339, 27, 26, 6, "#361019", "#260910");
  rounded(371, 339, 27, 26, 6, "#361019", "#260910");
  // Red enamel base, back edge, vent and yellow dial.
  shape([[248, 252], [366, 252], [395, 271], [414, 340], [396, 355], [245, 355], [221, 338], [239, 270]], "#a92337", "#330a13", 3);
  shape([[374, 267], [394, 272], [413, 337], [396, 347], [370, 337]], "#a32337", "#672232", 1.5);
  shape([[240, 271], [374, 271], [393, 338], [382, 350], [238, 350], [221, 337]], vertical(0, 269, 350, [[0, "#ff6860"], [.52, "#e63641"], [1, "#b02036"]]), "#71192e", 2);
  shape([[242, 263], [362, 256], [377, 273], [238, 273]], "#ef5354", "#9e2637");
  shape([[220, 338], [393, 338], [412, 332], [414, 343], [397, 354], [242, 354], [222, 347]], "#7d1c32", "#3d1017", 2);
  stroke([[244, 278], [367, 278]], "#ffb2a2", 1.75);
  for (let i = 0; i < 4; i += 1) {
    stroke([[385 + i * 3, 288 + i * 4], [390 + i * 3, 310 + i * 4]], "#6b192b", 1.4);
  }
  rounded(246, 294, 35, 19, 4, "#43111b", "#9b2332");
  rounded(251, 299, 6, 8, 2, loaded ? "#ffda45" : "#9e5751");
  stroke([[261, 303], [275, 303]], loaded ? "#ffe8a0" : "#bd7d64", 1.2);
  oval(324, 308, 26.5, 25, "#963433", "#772635", 1.6);
  oval(322, 306, 24, 23, vertical(0, 283, 329, [[0, "#ffe982"], [.42, "#ffda45"], [1, "#c28124"]]), "#823b2c", 2);
  oval(322, 305, 19, 18, "#ffcf40", "#fff1a0", 1.3);
  pen.save();
  pen.translate(322, 306);
  pen.rotate(running ? progress * Math.PI * 1.65 : -.24);
  rounded(-2, -13, 4, 14, 2, "#813b24");
  pen.restore();

  // Jar collar and back handle.
  rounded(259, 234, 105, 30, 6, "#ac6d25", "#542b27");
  oval(311, 236, 53, 11, "#de9f2b", "#542b27", 2);
  stroke([[270, 255], [352, 255]], "#efb94c", 1.8);
  pen.beginPath();
  pen.moveTo(365, 92);
  pen.bezierCurveTo(438, 77, 443, 144, 413, 182);
  pen.bezierCurveTo(398, 201, 381, 202, 356, 206);
  pen.strokeStyle = "#703b24";
  pen.lineWidth = 24;
  pen.stroke();
  pen.strokeStyle = "#da9727";
  pen.lineWidth = 17;
  pen.stroke();
  pen.strokeStyle = "#ffe577";
  pen.lineWidth = 6;
  pen.stroke();
  const glass = [[224, 73], [377, 72], [372, 120], [362, 208], [350, 235], [273, 235], [257, 213], [238, 106]];
  shape(glass, vertical(0, 70, 235, [[0, "#f5a181"], [.2, "#b96753"], [.75, "#73373a"], [1, "#4a1b25"]]), "#3b0f18", 3);
  shape([[239, 90], [365, 90], [350, 212], [343, 227], [279, 227], [267, 209]], "#53222c", "#db886b", 1.4);
  shape([[249, 100], [359, 100], [344, 219], [283, 219], [272, 204]], "#4a1f2a", "#3d1622");

  // Clip the artwork and its vortex inside the jar.
  pen.save();
  shape([[242, 88], [366, 88], [350, 224], [275, 224], [266, 208]], null);
  pen.clip();
  const blade = running ? Math.cos(progress * 92) : 1;
  oval(309, 219, 9, 5, "#f8d9ad", "#592733");
  shape([[310 - 29 * blade, 215], [308, 220], [310 + 29 * blade, 216], [315, 222], [304, 224]], "#d4a685", "#51212c");
  if (loaded && !running) artCard(picture, 308, 165, 54, -.19);
  if (running) drawVortex(picture, progress);
  pen.restore();

  // Front ribs, graduated marks and lid.
  shape([[242, 94], [252, 94], [280, 223], [273, 225], [259, 203]], "#ffe5b439");
  shape([[358, 95], [365, 95], [351, 218], [345, 227], [339, 226]], "#f7a78b44");
  stroke([[250, 103], [265, 175], [276, 217]], "#ffd9ab99", 2);
  stroke([[363, 97], [353, 180], [346, 219]], "#ffbc929e", 1.75);
  for (let n = 0; n < 6; n += 1) {
    const y = 112 + n * 15;
    const x = 353 - n * 1.6;
    stroke([[x - (n % 2 ? 7 : 12), y], [x, y]], "#eeb89aa0", 1.35);
  }
  stroke([[281, 228], [343, 228]], "#f4bb957a", 1.5);
  rounded(235, 58, 144, 24, 6, "#bc8126", "#683622");
  oval(306, 63, 77, 13, "#db9a27", "#733c21", 2);
  oval(306, 59, 73, 11, "#ffce43", "#fff0a1", 1.5);
  shape([[272, 52], [282, 37], [325, 37], [341, 51], [326, 57], [281, 57]], "#d69528", "#793e24", 2);
  oval(305, 38, 23, 6, "#ffdb55", "#fff0a1", 1.5);
  stroke([[238, 74], [269, 78], [356, 77], [374, 71]], "#ffe297", 1.5);
  pen.restore();
}

async function animateBlender(picture) {
  if (reducedMotion.matches) return;
  await new Promise(resolve => {
    const start = performance.now();
    function frame(now) {
      const progress = Math.min((now - start) / 2050, 1);
      drawMachine(picture, true, progress);
      if (progress === 1 || reducedMotion.matches || document.hidden) resolve();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

function sampleArt(index = 0) {
  const art = document.createElement("canvas");
  art.width = art.height = 144;
  const ctx = art.getContext("2d");
  const colors = [
    ["#101e32", "#2f5660", "#ff925e", "#edc686", "#3d655c", "#183b3e", "#14272d"],
    ["#401e2a", "#9b4d35", "#e3a35b", "#f3cc8f", "#a36746", "#5b3430", "#271e26"],
    ["#162635", "#46757a", "#a2d6b5", "#dbebc1", "#536b58", "#314443", "#142c38"]
  ][index];
  const sky = ctx.createLinearGradient(0, 0, 0, 100);
  sky.addColorStop(0, colors[0]);
  sky.addColorStop(1, colors[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 144, 144);
  ctx.beginPath();
  ctx.arc(91 - 12 * index, 58, 26, 0, Math.PI * 2);
  ctx.fillStyle = colors[2];
  ctx.fill();
  ctx.fillStyle = colors[3];
  for (let i = 0; i < 20; i += 1) {
    const x = (i * 53 + 12) % 144;
    const y = (i * 19 + 7) % 88;
    ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, 1);
  }
  const ridges = [
    [[0, 100], [18, 78], [39, 63], [57, 76], [67, 70], [92, 100], [114, 73], [144, 93]],
    [[0, 104], [28, 89], [47, 104], [65, 90], [80, 97], [117, 82], [144, 91]],
    [[0, 120], [35, 111], [49, 119], [70, 127], [115, 104], [144, 113]]
  ];
  ridges.forEach((ridge, i) => {
    ctx.beginPath();
    ridge.forEach(([x, y], at) => at ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.lineTo(144, 144);
    ctx.lineTo(0, 144);
    ctx.closePath();
    ctx.fillStyle = colors[4 + i];
    ctx.fill();
  });
  ctx.strokeStyle = colors[3];
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(77, 106);
  ctx.lineTo(67, 112);
  ctx.lineTo(86, 115);
  ctx.lineTo(62, 124);
  ctx.lineTo(74, 130);
  ctx.lineTo(53, 144);
  ctx.stroke();
  return art.toDataURL("image/webp", .86);
}
