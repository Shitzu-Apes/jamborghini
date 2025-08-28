// Jamborghini — JAMBO Token Meme Car Game with Three.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('c');
const ui = {
  dist: document.getElementById('dist'),
  banked: document.getElementById('banked'),
  carry: document.getElementById('carry'),

  controlsOverlay: document.getElementById('controls-overlay'),
  startGame: document.getElementById('start-game'),
  showControls: document.getElementById('show-controls'),
  gameOverOverlay: document.getElementById('game-over-overlay'),
  finalDist: document.getElementById('final-dist'),
  finalBanked: document.getElementById('final-banked'),
  finalLost: document.getElementById('final-lost'),

  copyScore: document.getElementById('copy-score'),
  shareScore: document.getElementById('share-score'),
  playAgain: document.getElementById('play-again')
};

// Car selection
let selectedCar = 'jamborghini';
const carOptions = document.querySelectorAll('.car-option');
carOptions.forEach(option => {
  option.addEventListener('click', () => {
    carOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    selectedCar = option.dataset.car;
    
    // Update car in game if already started
    if(gameStarted && carTextures[selectedCar]) {
      createCarSprite(selectedCar);
    }
  });
});

// Load best score


// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0c);
scene.fog = new THREE.Fog(0x0a0a0c, 50, 120);

// Camera — orthographic top-down view (flipped perspective)
let W = innerWidth, H = innerHeight;
const aspect = W/H;

// Adjust viewSize based on screen width for mobile optimization
let viewSize = 22;
if (W <= 480) {
  viewSize = 28; // Zoomed OUT view on mobile (larger = further)
} else if (W <= 600) {
  viewSize = 25; // Slightly zoomed OUT on small screens
}

const camera = new THREE.OrthographicCamera(
  -viewSize*aspect/2, viewSize*aspect/2, 
  viewSize/2, -viewSize/2, 
  0.1, 200
);
camera.position.set(0, 25, 0.01);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Use proper tone mapping for color accuracy
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Lighting
scene.add(new THREE.AmbientLight(0x404040, 0.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(-10, 20, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// Road setup
const ROAD_W = 15;
const LANE_W = ROAD_W / 3;
const ROAD_LENGTH = 300;

// Create road surface
const roadGeom = new THREE.PlaneGeometry(ROAD_W, ROAD_LENGTH);
const roadMat = new THREE.MeshLambertMaterial({ 
  color: 0x1a1a1f,
  transparent: true,
  opacity: 0.9 
});
const road = new THREE.Mesh(roadGeom, roadMat);
road.rotation.x = -Math.PI/2;
road.position.set(0, -0.01, 0);
road.receiveShadow = true;
scene.add(road);

// Lane markers
function createLaneMarker(x, z) {
  const markerGeom = new THREE.BoxGeometry(0.2, 0.05, 3);
  const markerMat = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.6 
  });
  const marker = new THREE.Mesh(markerGeom, markerMat);
  marker.position.set(x, 0.025, z);
  return marker;
}

// Create dashed lane lines
for(let i = 1; i < 3; i++) {
  const x = -ROAD_W/2 + i * LANE_W;
  for(let z = -ROAD_LENGTH/2; z < ROAD_LENGTH/2; z += 8) {
    scene.add(createLaneMarker(x, z));
  }
}

// Road borders
const borderMat = new THREE.MeshBasicMaterial({ color: 0x22ffaa });
const leftBorder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, ROAD_LENGTH), borderMat);
leftBorder.position.set(-ROAD_W/2 - 0.5, 0.15, 0);
scene.add(leftBorder);

const rightBorder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, ROAD_LENGTH), borderMat);
rightBorder.position.set(ROAD_W/2 + 0.5, 0.15, 0);
scene.add(rightBorder);

// Player car (Sprite-based)
const carGroup = new THREE.Group();
let carSprite = null;
const wheels = []; // Keep for animation

// Load car textures, coin texture, truck texture, and cone texture
const textureLoader = new THREE.TextureLoader();
const carTextures = {};
let coinTexture = null;
let truckTexture = null;
let coneTexture = null;

function loadCarTextures() {
  const carNames = ['jamborghini', 'jambosuv', 'jambmw'];
  const allTextures = [...carNames, 'coin', 'truck', 'cone'];
  return Promise.all(allTextures.map(name => {
    return new Promise((resolve, reject) => {
      textureLoader.load(
        `${name}.webp`,
        (texture) => {
          // Configure texture for proper sprite rendering
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.generateMipmaps = false;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.flipY = true;
          texture.encoding = THREE.sRGBEncoding;
          
          if(name === 'coin') {
            coinTexture = texture;
          } else if(name === 'truck') {
            // Flip the truck texture upside down
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, -1); // Flip vertically
            texture.offset.set(0, 1); // Adjust offset to show correctly
            truckTexture = texture;
          } else if(name === 'cone') {
            coneTexture = texture;
          } else {
            carTextures[name] = texture;
          }
          resolve();
        },
        undefined,
        reject
      );
    });
  }));
}

function createCarSprite(carType = 'jamborghini') {
  if(carSprite) {
    carGroup.remove(carSprite);
  }
  
  const texture = carTextures[carType];
  if(!texture) return;
  
  const spriteMaterial = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true,
    alphaTest: 0.1,
    // Prevent lighting interference
    fog: false,
    // Re-enable tone mapping for proper color handling
    toneMapped: true
  });
  
  carSprite = new THREE.Sprite(spriteMaterial);
  
  // Calculate proper aspect ratios for each car
  const carDimensions = {
    'jamborghini': { width: 694, height: 856 },
    'jambosuv': { width: 723, height: 1079 },
    'jambmw': { width: 678, height: 813 }
  };
  
  const dims = carDimensions[carType] || carDimensions['jamborghini'];
  const aspectRatio = dims.height / dims.width;
  
  // Keep consistent width, scale height by aspect ratio
  const targetWidth = 1.4;
  const targetHeight = targetWidth * aspectRatio;
  
  carSprite.scale.set(targetWidth, targetHeight, 1);
  carSprite.position.y = 0.4;
  carGroup.add(carSprite);
}

// Create invisible wheels for animation effect
const wheelGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8);
const wheelMat = new THREE.MeshPhongMaterial({ 
  color: 0x333333,
  transparent: true,
  opacity: 0.6
});
for(let i = 0; i < 4; i++) {
  const wheel = new THREE.Mesh(wheelGeom, wheelMat);
  wheel.rotation.z = Math.PI/2;
  const x = i % 2 === 0 ? -0.5 : 0.5;
  const z = i < 2 ? 0.6 : -0.6;
  wheel.position.set(x, 0.1, z);
  carGroup.add(wheel);
  wheels.push(wheel);
}

carGroup.position.set(0, 0, -7); // Car at TOP of screen
scene.add(carGroup);

// Shield effect
const shieldGeom = new THREE.TorusGeometry(2.2, 0.08, 8, 32);
const shieldMat = new THREE.MeshBasicMaterial({ 
  color: 0x00ffd0, 
  transparent: true, 
  opacity: 0.6 
});
const shield = new THREE.Mesh(shieldGeom, shieldMat);
shield.rotation.x = Math.PI/2;
shield.visible = false;
carGroup.add(shield);

// Game state
let carLane = 1; // 0, 1, 2
let targetX = laneToX(carLane);
let running = false; // Start paused to show controls
let gameStarted = false;
let carry = 0, banked = 0, dist = 0;
let speed = 2.0;
let nextSpawn = 0;
let nextCheckpoint = 400;
let shieldMs = 0;
let gameTime = 0;

// Entities
const entities = [];
const entityPool = [];

function laneToX(lane) {
  return -ROAD_W/2 + LANE_W/2 + lane * LANE_W;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// Entity creation
function createEntity(type, lane = Math.floor(Math.random() * 3)) {
  let mesh, w = 1, h = 1, d = 1, value = 1;
  const x = laneToX(lane);
  
  if(type === 'coin') {
    if(coinTexture) {
      // Use coin sprite
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: coinTexture,
        transparent: true,
        alphaTest: 0.1,
        fog: false,
        toneMapped: true
      });
      mesh = new THREE.Sprite(spriteMaterial);
      mesh.scale.set(0.8, 0.8, 1);
    } else {
      // Fallback to 3D geometry if texture not loaded
      const geom = new THREE.CylinderGeometry(0.4, 0.4, 0.15, 12);
      const mat = new THREE.MeshPhongMaterial({ 
        color: 0xb6ff00, 
        shininess: 100,
        emissive: 0x1a2200
      });
      mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = Math.PI/2;
    }
    mesh.position.y = 0.4;
    w = 0.8; h = 0.8; d = 0.8;
    value = 1;
    
  } else if(type === 'cone') {
    if(coneTexture) {
      // Use cone sprite with proper aspect ratio
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: coneTexture,
        transparent: true,
        alphaTest: 0.1,
        fog: false,
        toneMapped: true
      });
      mesh = new THREE.Sprite(spriteMaterial);
      
      // Use actual cone dimensions: 213x256
      const aspectRatio = 256 / 213; // Height / Width = 1.202
      const targetWidth = 1.0;
      const targetHeight = targetWidth * aspectRatio;
      
      mesh.scale.set(targetWidth, targetHeight, 1);
    } else {
      // Fallback to 3D geometry if texture not loaded
      const geom = new THREE.ConeGeometry(0.6, 1.2, 8);
      const mat = new THREE.MeshPhongMaterial({ color: 0xff4444 });
      mesh = new THREE.Mesh(geom, mat);
    }
    mesh.position.y = 0.4;
    w = 1.0; h = 1.0; d = 1.0; // Consistent collision box
    
  } else if(type === 'truck') {
    if(truckTexture) {
      // Use truck sprite with proper aspect ratio
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: truckTexture,
        transparent: true,
        alphaTest: 0.1,
        fog: false,
        toneMapped: true
      });
      mesh = new THREE.Sprite(spriteMaterial);
      
      // Use actual truck dimensions: 256x696
      const aspectRatio = 696 / 256; // Height / Width = 2.71875
      const targetWidth = 1.8;
      const targetHeight = targetWidth * aspectRatio;
      
      mesh.scale.set(targetWidth, targetHeight, 1); // Normal scaling, texture is already flipped
    } else {
      // Fallback to 3D geometry if texture not loaded
      const group = new THREE.Group();
      
      // Truck body
      const bodyGeom = new THREE.BoxGeometry(2.2, 1.4, 4);
      const bodyMat = new THREE.MeshPhongMaterial({ color: 0xff6600 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.7;
      body.castShadow = true;
      group.add(body);
      
      // Truck cab
      const cabGeom = new THREE.BoxGeometry(2, 1, 1.5);
      const cabMat = new THREE.MeshPhongMaterial({ color: 0xcc4400 });
      const cab = new THREE.Mesh(cabGeom, cabMat);
      cab.position.set(0, 1.2, 1.8);
      group.add(cab);
      
      mesh = group;
    }
    mesh.position.y = 0.4;
    w = 1.8; h = 1.8; d = 1.8; // Consistent collision box
    
  } else if(type === 'shield') {
    const geom = new THREE.OctahedronGeometry(0.7);
    const mat = new THREE.MeshPhongMaterial({ 
      color: 0x00ffd0, 
      shininess: 100,
      transparent: true,
      opacity: 0.8
    });
    mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = 0.7;
    w = 1.4; h = 1.4; d = 1.4;
    
  } else if(type === 'checkpoint') {
    const group = new THREE.Group();
    
    // Main checkpoint bar
    const barGeom = new THREE.BoxGeometry(ROAD_W - 1, 0.4, 1);
    const barMat = new THREE.MeshPhongMaterial({ 
      color: 0x3366ff, 
      transparent: true, 
      opacity: 0.7,
      emissive: 0x001133
    });
    const bar = new THREE.Mesh(barGeom, barMat);
    bar.position.y = 0.2;
    group.add(bar);
    
    // Checkpoint pillars
    const pillarGeom = new THREE.BoxGeometry(0.5, 2, 0.5);
    const pillarMat = new THREE.MeshPhongMaterial({ color: 0x2244cc });
    
    const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
    leftPillar.position.set(-ROAD_W/2 + 0.5, 1, 0);
    group.add(leftPillar);
    
    const rightPillar = new THREE.Mesh(pillarGeom, pillarMat);
    rightPillar.position.set(ROAD_W/2 - 0.5, 1, 0);
    group.add(rightPillar);
    
    mesh = group;
    lane = -1; // spans all lanes
    w = ROAD_W - 1; h = 0.4; d = 1;
  }
  
  const entity = {
    mesh,
    type,
    lane,
    w, h, d,
    value,
    hit: false,
    vy: -(speed * 0.7 + (type === 'coin' ? 2 : 0))
  };
  
  mesh.position.x = type === 'checkpoint' ? 0 : x;
  mesh.position.z = 30; // Spawn from BOTTOM of screen (positive Z)
  mesh.userData = entity;
  
  scene.add(mesh);
  entities.push(entity);
  
  return entity;
}

function removeEntity(entity) {
  scene.remove(entity.mesh);
  const index = entities.indexOf(entity);
  if(index > -1) entities.splice(index, 1);
}

// Collision detection
function checkCollision(a, b) {
  const dx = Math.abs(a.mesh.position.x - b.mesh.position.x);
  const dz = Math.abs(a.mesh.position.z - b.mesh.position.z);
  return dx < (a.w + b.w) / 2 && dz < (a.d + b.d) / 2;
}

// Input handling
let inputLeft = false, inputRight = false;

addEventListener('keydown', e => {
  if(!gameStarted) return;
  if(e.code === 'ArrowLeft' || e.code === 'KeyA') inputLeft = true;
  if(e.code === 'ArrowRight' || e.code === 'KeyD') inputRight = true;
  if(e.code === 'Space' && !running) restart();
});

addEventListener('keyup', e => {
  if(e.code === 'ArrowLeft' || e.code === 'KeyA') inputLeft = false;
  if(e.code === 'ArrowRight' || e.code === 'KeyD') inputRight = false;
});

// Touch controls
canvas.addEventListener('pointerdown', e => {
  if(!gameStarted) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  if(x < 0.5) inputLeft = true;
  else inputRight = true;
});

addEventListener('pointerup', () => {
  inputLeft = false;
  inputRight = false;
});

// Controls overlay handlers
function showControlsOverlay() {
  ui.controlsOverlay.style.display = 'flex';
  running = false;
}

function hideControlsOverlay() {
  ui.controlsOverlay.style.display = 'none';
  if(gameStarted) {
    running = true;
  }
}

function startGame() {
  hideControlsOverlay();
  gameStarted = true;
  running = true;
  // Create car sprite with selected car
  createCarSprite(selectedCar);
  restart();
}

ui.startGame.addEventListener('click', startGame);
ui.showControls.addEventListener('click', showControlsOverlay);

// Close overlay when clicking outside content
ui.controlsOverlay.addEventListener('click', e => {
  if(e.target === ui.controlsOverlay) {
    if(gameStarted) hideControlsOverlay();
  }
});

// ESC key to toggle controls
addEventListener('keydown', e => {
  if(e.code === 'Escape') {
    if(ui.controlsOverlay.style.display === 'flex') {
      if(gameStarted) hideControlsOverlay();
    } else {
      showControlsOverlay();
    }
  }
});

// Game functions
function restart() {
  // Clear entities
  entities.forEach(removeEntity);
  
  // Reset state
  carLane = 1;
  targetX = laneToX(carLane);
  carGroup.position.set(targetX, 0, -7); // Reset car to TOP position
  carry = banked = dist = 0;
  speed = 2.0;
  nextSpawn = 0;
  nextCheckpoint = 400;
  shieldMs = 0;
  gameTime = 0;
  running = gameStarted; // Only run if game has been started
  
  // Hide game over dialog if visible
  ui.gameOverOverlay.style.display = 'none';
  updateUI();
}

function gameOver() {
  running = false;
  
  // Show game over dialog with stats
  ui.finalDist.textContent = Math.floor(dist) + ' m';
  ui.finalBanked.textContent = banked;
  ui.finalLost.textContent = carry; // Coins lost = carry coins when crashed
  ui.gameOverOverlay.style.display = 'flex';
}

function updateUI() {
  ui.dist.textContent = Math.floor(dist);
  ui.banked.textContent = banked;
  ui.carry.textContent = carry;
}

// Game loop
let lastTime = performance.now();

function animate(currentTime) {
  requestAnimationFrame(animate);
  
  const deltaTime = Math.min(50, currentTime - lastTime);
  lastTime = currentTime;
  
  if(!running) {
    renderer.render(scene, camera);
    return;
  }
  
  gameTime += deltaTime;
  
  // Progressive difficulty ramp - gets intense over time
  const speedMultiplier = 1 + (gameTime / 40000); // Double speed after 40 seconds (slower ramp)
  const currentMaxSpeed = 2.0 * speedMultiplier;
  speed += 0.002 * deltaTime; // Faster acceleration
  if(speed > currentMaxSpeed) speed = currentMaxSpeed;
  
  // Handle input
  if(inputLeft && carLane > 0) {
    carLane--;
    inputLeft = false;
  }
  if(inputRight && carLane < 2) {
    carLane++;
    inputRight = false;
  }
  
  // Smooth car movement
  targetX = laneToX(carLane);
  carGroup.position.x += (targetX - carGroup.position.x) * 0.15;
  
  // Animate wheels
  wheels.forEach(wheel => {
    wheel.rotation.y += speed * 0.01;
  });
  
  // Animate shield
  if(shieldMs > 0) {
    shield.visible = true;
    shield.rotation.z += 0.05;
    shieldMs -= deltaTime;
  } else {
    shield.visible = false;
  }
  
  // Move entities (very slow initially, scales with speed)
  const moveDistance = (speed * deltaTime) / 1000 * 6;
  for(const entity of entities) {
    entity.mesh.position.z -= moveDistance; // Move toward car at TOP (negative direction)
  }
  
  // Spawn entities
  nextSpawn -= deltaTime;
  if(nextSpawn <= 0) {
    nextSpawn = rand(600, 1200) / (speed / 2.0); // Scale with speed, even longer intervals initially
    
    const roll = Math.random();
    if(roll < 0.55) createEntity('coin');
    else if(roll < 0.8) createEntity('cone');
    else if(roll < 0.95) createEntity('truck');
    else createEntity('shield');
  }
  
  // Spawn checkpoints
  if(dist >= nextCheckpoint) {
    createEntity('checkpoint');
    nextCheckpoint += 500 + Math.min(1000, dist * 0.1);
  }
  
  // Handle collisions and cleanup
  const carEntity = { 
    mesh: carGroup, 
    w: 1.4, 
    h: 0.8, 
    d: 2.6 
  };
  
  for(let i = entities.length - 1; i >= 0; i--) {
    const entity = entities[i];
    
    // Remove entities that are too far past the car at top
    if(entity.mesh.position.z < -15) {
      removeEntity(entity);
      continue;
    }
    
    // Checkpoint banking
    if(entity.type === 'checkpoint' && 
       Math.abs(entity.mesh.position.z - carGroup.position.z) < 1.5) {
      banked += carry;
      carry = 0;
      entity.hit = true;
      removeEntity(entity);
      continue;
    }
    
    // Collision detection
    if(checkCollision(carEntity, entity) && !entity.hit) {
      entity.hit = true;
      
      if(entity.type === 'coin') {
        carry += entity.value;
        removeEntity(entity);
        
      } else if(entity.type === 'shield') {
        shieldMs = 3000;
        removeEntity(entity);
        
      } else if(entity.type === 'cone' || entity.type === 'truck') {
        if(shieldMs > 0) {
          shieldMs = 0;
          removeEntity(entity);
        } else {
          gameOver();
          return;
        }
      }
    }
    
    // Animate entities
    if(entity.type === 'coin') {
      entity.mesh.rotation.y += 0.05;
    } else if(entity.type === 'shield') {
      entity.mesh.rotation.x += 0.03;
      entity.mesh.rotation.y += 0.05;
    }
  }
  
  // Update distance (scales with actual movement)
  dist += moveDistance * 2.5;
  
  // Update UI
  updateUI();
  
  // Render
  renderer.render(scene, camera);
}

// Handle window resize
addEventListener('resize', () => {
  W = innerWidth;
  H = innerHeight;
  const aspect = W / H;
  
  // Update viewSize based on new screen width
  if (W <= 480) {
    viewSize = 28; // Zoomed OUT view on mobile (larger = further)
  } else if (W <= 600) {
    viewSize = 25; // Slightly zoomed OUT on small screens
  } else {
    viewSize = 22; // Default view size
  }
  
  camera.left = -viewSize * aspect / 2;
  camera.right = viewSize * aspect / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();
  
  renderer.setSize(W, H);
});

// Game over dialog handlers
ui.playAgain.onclick = () => {
  ui.gameOverOverlay.style.display = 'none';
  restart();
};

ui.copyScore.onclick = async () => {
  try {
    // Create a canvas with the game stats (similar to game over screen)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 500;
    canvas.height = 700;
    
    // Background gradient (same as game over screen)
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0b0b0c');
    gradient.addColorStop(1, '#151518');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border (similar to game over screen)
    ctx.strokeStyle = 'rgba(34, 255, 170, 0.4)';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    
    // Title
    ctx.fillStyle = '#22ffaa';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏁 GAME OVER', canvas.width/2, 80);
    
    // Load and draw the selected car image
    const carImg = new Image();
    carImg.crossOrigin = 'anonymous';
    
    try {
      await new Promise((resolve, reject) => {
        carImg.onload = () => {
          // Draw car image (centered, scaled to fit nicely)
          const carSize = 120;
          const carX = (canvas.width - carSize) / 2;
          const carY = 100;
          ctx.drawImage(carImg, carX, carY, carSize, carSize);
          resolve();
        };
        carImg.onerror = reject;
        carImg.src = `${selectedCar}.webp`;
      });
    } catch (e) {
      console.log('Could not load car image, continuing without it');
    }
    
    // Stats grid background (glassmorphism effect)
    ctx.fillStyle = 'rgba(34, 255, 170, 0.1)';
    ctx.fillRect(50, 250, canvas.width - 100, 280);
    ctx.strokeStyle = 'rgba(34, 255, 170, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(50, 250, canvas.width - 100, 280);
    
    // Stats (same layout as game over screen)
    const stats = [
      { label: 'Distance', value: ui.finalDist.textContent },
      { label: '$JAMBO Banked', value: ui.finalBanked.textContent },
      { label: 'Coins Lost', value: ui.finalLost.textContent }
    ];
    
    stats.forEach((stat, i) => {
      const y = 285 + (i * 60);
      
      // Stat label
      ctx.fillStyle = '#cccccc';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(stat.label, canvas.width/2, y);
      
      // Stat value
      ctx.fillStyle = '#22ffaa';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(stat.value.toString(), canvas.width/2, y + 25);
    });
    
    // Footer
    ctx.fillStyle = '#888888';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('JAMBO Exchange - Pure Entertainment Value', canvas.width/2, 580);
    ctx.fillText('No guaranteed utility • DYOR', canvas.width/2, 600);
    ctx.fillText('Play at jamborghini.near', canvas.width/2, 620);
    
    // Copy to clipboard
    canvas.toBlob(async (blob) => {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      ui.copyScore.innerHTML = '✅ Copied!';
      setTimeout(() => {
        ui.copyScore.innerHTML = '📷 Copy as Image';
      }, 2000);
    });
  } catch (error) {
    console.error('Failed to copy image:', error);
    ui.copyScore.innerHTML = '❌ Failed';
    setTimeout(() => {
      ui.copyScore.innerHTML = '📷 Copy as Image';
    }, 2000);
  }
};

ui.shareScore.onclick = () => {
  const text = `🏁 Just drove ${ui.finalDist.textContent} in Jamborghini! 
🪙 Banked ${ui.finalBanked.textContent} $JAMBO coins
💼 Lost ${ui.finalLost.textContent} in the crash 

Get JAMBO -> Buy Lambo 🚗💨

#JAMBORGHINI`;
  
  const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
  window.open(url, '_blank');
};

// Initialize game
async function init() {
  try {
    await loadCarTextures();
    console.log('Car textures loaded successfully');
    // Create default car sprite
    createCarSprite(selectedCar);
  } catch (error) {
    console.warn('Failed to load some car textures:', error);
    // Fallback to 3D car if textures fail
    createFallbackCar();
  }
  
  updateUI();
  animate(performance.now());
}

function createFallbackCar() {
  // Simple colored box as fallback
  const fallbackGeom = new THREE.BoxGeometry(1.4, 0.8, 2.2);
  const fallbackMat = new THREE.MeshPhongMaterial({ color: 0x22ffaa });
  const fallbackCar = new THREE.Mesh(fallbackGeom, fallbackMat);
  fallbackCar.position.y = 0.4;
  carGroup.add(fallbackCar);
}

// Start the game
init();
