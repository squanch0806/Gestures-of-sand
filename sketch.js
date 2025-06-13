function make2DArray(cols, rows) {
  let arr = new Array(cols);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = new Array(rows);
    for (let j = 0; j < arr[i].length; j++) {
      arr[i][j] = 0;
    }
  }
  return arr;
}

let grid;
let velocityGrid;

let w = 5;
let cols, rows;
let hueValue = 0;
const colorSpeed = 0.8;
const saturation = 85;
const brightness = 95;

let gravity = 0.1;

let video;
let handpose;
let predictions = [];
let handLandmarks = [];
let isFist = false;
let fistPosition = { x: 0, y: 0 };
let varianceThreshold = 150;

let canvasWidth = 800;
let canvasHeight = 600;

let videoWidth = 640;
let videoHeight = 480;
let videoScaleX = 1;
let videoScaleY = 1;

let isMousePressed = false;
let useMouseControl = true;

function withinCols(i) {
  return i >= 0 && i <= cols - 1;
}

function withinRows(j) {
  return j >= 0 && j <= rows - 1;
}

function setup() {
  let canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent('canvas-container');
  colorMode(HSB, 360, 255, 255);
  
  cols = canvasWidth / w;
  rows = canvasHeight / w;
  grid = make2DArray(cols, rows);
  velocityGrid = make2DArray(cols, rows, 1);
  
  video = createCapture(VIDEO);
  video.size(videoWidth, videoHeight);
  video.hide();
  
  handpose = ml5.handpose(video, modelReady);
  
  handpose.on('predict', results => {
    predictions = results;
    if (results.length > 0) {
      handLandmarks = results[0].landmarks;
      checkFist();
    } else {
      isFist = false;
      handLandmarks = [];
    }
  });
  
  videoScaleX = canvasWidth / videoWidth;
  videoScaleY = canvasHeight / videoHeight;
}

function modelReady() {
  console.log('手势识别模型加载完成');
}

function checkFist() {
  if (handLandmarks && handLandmarks.length > 0) {
    let fingertips = [];
    
    let fingertipIndices = [4, 8, 12, 16, 20];
    for (let i of fingertipIndices) {
      if (i < handLandmarks.length) {
        fingertips.push(handLandmarks[i][1]);
      }
    }
    
    if (fingertips.length > 0) {
      let mean = fingertips.reduce((a, b) => a + b, 0) / fingertips.length;
      let variance = fingertips.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / fingertips.length;
      
      isFist = variance < varianceThreshold;
      
      if (isFist) {
        let lowestPoint = handLandmarks[0];
        for (let landmark of handLandmarks) {
          if (landmark[1] > lowestPoint[1]) {
            lowestPoint = landmark;
          }
        }
        fistPosition.x = lowestPoint[0];
        fistPosition.y = lowestPoint[1];
      }
    }
  }
}

function draw() {
  clear();
  background(0);
  
  let videoLayer = createGraphics(canvasWidth, canvasHeight);
  
  videoLayer.push();
  videoLayer.translate(videoLayer.width, 0);
  videoLayer.scale(-1, 1);
  videoLayer.tint(255, 150);
  
  let aspectRatio = videoWidth / videoHeight;
  let drawWidth = canvasWidth * 0.9;
  let drawHeight = drawWidth / aspectRatio;
  
  if (drawHeight > canvasHeight * 0.9) {
    drawHeight = canvasHeight * 0.9;
    drawWidth = drawHeight * aspectRatio;
  }
  
  let xOffset = (canvasWidth - drawWidth) / 2;
  let yOffset = (canvasHeight - drawHeight) / 2;
  
  videoLayer.image(video, xOffset, yOffset, drawWidth, drawHeight);
  videoLayer.pop();
  
  videoScaleX = drawWidth / videoWidth;
  videoScaleY = drawHeight / videoHeight;
  
  image(videoLayer, 0, 0);
  
  if (handLandmarks && handLandmarks.length > 0) {
    push();
    translate(width, 0);
    scale(-1, 1);
    
    for (let i = 0; i < handLandmarks.length; i++) {
      let x = handLandmarks[i][0] * videoScaleX + xOffset;
      let y = handLandmarks[i][1] * videoScaleY + yOffset;
      
      fill(120, 255, 255);
      noStroke();
      ellipse(x, y, 10, 10);
    }
    pop();
    
    if (isFist) {
      fill(255, 0, 0);
      noStroke();
      
      let mirroredX = canvasWidth - (fistPosition.x * videoScaleX + xOffset);
      let adjustedY = fistPosition.y * videoScaleY + yOffset;
      
      ellipse(mirroredX, adjustedY, 15, 15);
    }
  }
  
  if (isFist) {
    let mirroredX = canvasWidth - (fistPosition.x * videoScaleX + xOffset);
    let adjustedY = fistPosition.y * videoScaleY + yOffset;
    
    let fistCol = floor(mirroredX / w);
    let fistRow = floor(adjustedY / w);
    addSand(fistCol, fistRow);
  }
  
  if (isMousePressed && useMouseControl) {
    let mouseCol = floor(mouseX / w);
    let mouseRow = floor(mouseY / w);
    addSand(mouseCol, mouseRow);
  }
  
  updateSandPhysics();
  
  let sandLayer = createGraphics(canvasWidth, canvasHeight);
  
  drawSandOnLayer(sandLayer);
  
  image(sandLayer, 0, 0);
}

function updateSandPhysics() {
  let nextGrid = make2DArray(cols, rows);
  let nextVelocityGrid = make2DArray(cols, rows);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let state = grid[i][j];
      let velocity = velocityGrid[i][j];
      let moved = false;
      if (state > 0) {
        let newPos = int(j + velocity);
        for (let y = newPos; y > j; y--) {
          if (y >= rows) continue;
          
          let below = grid[i][y];
          let dir = 1;
          if (random(1) < 0.5) {
            dir *= -1;
          }
          let belowA = -1;
          let belowB = -1;
          if (withinCols(i + dir)) belowA = grid[i + dir][y];
          if (withinCols(i - dir)) belowB = grid[i - dir][y];

          if (below === 0) {
            nextGrid[i][y] = state;
            nextVelocityGrid[i][y] = velocity + gravity;
            moved = true;
            break;
          } else if (belowA === 0) {
            nextGrid[i + dir][y] = state;
            nextVelocityGrid[i + dir][y] = velocity + gravity;
            moved = true;
            break;
          } else if (belowB === 0) {
            nextGrid[i - dir][y] = state;
            nextVelocityGrid[i - dir][y] = velocity + gravity;
            moved = true;
            break;
          }
        }
      }

      if (state > 0 && !moved) {
        nextGrid[i][j] = grid[i][j];
        nextVelocityGrid[i][j] = velocityGrid[i][j] + gravity;
      }
    }
  }
  grid = nextGrid;
  velocityGrid = nextVelocityGrid;
}

function drawSandOnLayer(layer) {
  layer.colorMode(HSB, 360, 255, 255);
  
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (grid[i][j] > 0) {
        layer.noStroke();
        layer.fill(grid[i][j], 255, 255);
        let x = i * w;
        let y = j * w;
        layer.square(x, y, w);
      }
    }
  }
}

function addSand(centerCol, centerRow) {
  let matrix = 5;
  let extent = floor(matrix / 2);
  for (let i = -extent; i <= extent; i++) {
    for (let j = -extent; j <= extent; j++) {
      if (random(1) < 0.75) {
        let col = centerCol + i;
        let row = centerRow + j;
        if (withinCols(col) && withinRows(row)) {
          let baseHue = (hueValue + col * 0.3 + row * 0.2) % 360;
          let hueVariation = sin(frameCount * 0.1) * 15;
          
          let particleHue = (baseHue + hueVariation + random(-5, 5)) % 360;
          grid[col][row] = particleHue;
          velocityGrid[col][row] = 1;
        }
      }
    }
  }
  hueValue += colorSpeed;
  if (hueValue > 360) {
    hueValue = 0;
  }
}

function mousePressed() {
  isMousePressed = true;
}

function mouseReleased() {
  isMousePressed = false;
}

function mouseDragged() {
  if (useMouseControl) {
    let mouseCol = floor(mouseX / w);
    let mouseRow = floor(mouseY / w);
    addSand(mouseCol, mouseRow);
  }
}
