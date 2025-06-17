// Major Project || Orbital Navigator
// William Sherwood
// June 13, 2025

const G = 6.67e-11; // Gravitational constant

let pi = 3.1415926535897932384626433832795028841971693993; //canvas isn't initialized yet can't use MATH

// Celestial body data
const SUN = {
  radius: 6.96265e8,
  mass: 1.9891e30,
};

const EARTH = {
  radius: 6.37e6,
  mass: 5.98e24,
  orbitRadius: 1.496e11,
  orbitSpeed: 2.978e4,
  orbitAngle: 0
};

const MOON = {
  radius: 1.7374e6,
  mass: 7.34767309e22,
  orbitRadius: 3.844e8,
  orbitSpeed: 1.022e3,
};

const MERCURY = {
  radius: 2.4395e6,
  mass: 3.30e23,
  orbitRadius: 5.79e10,
  orbitSpeed: 4.74e4,
  orbitAngle: (2/3) * pi
};

const VENUS = {
  radius: 6.052e6,
  mass: 4.87e24,
  orbitRadius: 1.089e11,
  orbitSpeed: 3.5e4,
  orbitAngle: (7/4) * pi
};

const MARS = {
  radius: 3.396e6,
  mass: 6.42e23,
  orbitRadius: 2.28e11,
  orbitSpeed: 2.41e4,
  orbitAngle: (1/2) * pi
};

const JUPITER = {
  radius: 7.1492e7,
  mass: 1.898e27,
  orbitRadius: 7.785e11,
  orbitSpeed: 1.31e4,
  orbitAngle: pi
};

const SATURN = {
  radius: 6.0268e7,
  mass: 5.68e26,
  orbitRadius: 1.432e12,
  orbitSpeed: 9.7e3,
  orbitAngle: (3/2) * pi
};

const URANUS = {
  radius: 2.5559e7,
  mass: 8.68e25,
  orbitRadius: 2.867e12,
  orbitSpeed: 6.8e3,
  orbitAngle: (5/4) * pi
};

const NEPTUNE = {
  radius: 2.4764e7,
  mass: 1.02e26,
  orbitRadius: 4.515e12,
  orbitSpeed: 5.4e3,
  orbitAngle: (3/2) * pi
};

// Colours for menus
const MENU_COLORS = {
  background: [5, 5, 15],
  primary: [100, 150, 255],
  secondary: [50, 100, 200],
  accent: [255, 200, 50],
  text: [255, 255, 255],
  selected: [255, 255, 100]
};

const ZOOM_MIN = 0.0000000000001;
const ZOOM_MAX = 3;

let gameState = 'MENU'; // 'Menu', 'GAME', 'PAUSED', 'SETTINGS'
let menuSelection = 0;
let menuOptions = ['Start Mission', 'Settings', 'Tutorial'];
let menuTransition = 0;
let sun, earth, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune;
let planets = [];
let stations = [];
let startingFuel = Infinity; // Don't run out of fuel
let buttonSound;
let rocketSound;
let rocket;
let rocketImage = {};
let backgroundImage;
let zoomLevel = 1;
let maxSteps = 10000; // Maximum depth of trajectory calculator
let startingPlanet = EARTH; // Where the rocket starts

// Time control variables
let baseTimeStep = 1.0; 
let timeMultiplier = 1.0;
let currentTimeStep = 1.0;

function preload(){
  //preload sounds
  rocketSound = loadSound('assets/rocket-thrust.mp3');
  buttonSound = loadSound('assets/select.ogg');
  //preload all images
  backgroundImage = loadImage('assets/backgroundImage.png');
  rocketImage.noThrust = loadImage('assets/rocket.png');
  rocketImage.thrust = loadImage('assets/rocket_thrust.png');
  EARTH.image = loadImage('assets/earth.png');
  MOON.image = loadImage('assets/moon.png');
  SUN.image = loadImage('assets/sun.png');
  MERCURY.image = loadImage('assets/mercury.png');
  VENUS.image = loadImage('assets/venus.png');
  MARS.image = loadImage('assets/mars.png');
  JUPITER.image = loadImage('assets/jupiter.png');
  SATURN.image = loadImage('assets/saturn.png');
  URANUS.image = loadImage('assets/uranus.png');
  NEPTUNE.image = loadImage('assets/neptune.png');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  push();
  // draw stars background
  background(0);
  image(backgroundImage, 0, 0, width, height);

  // determine which part of the game is running right now
  switch(gameState) {
  case 'MENU':
    drawMainMenu();
    break;
  case 'GAME':
    runGame();
    break;
  case 'PAUSED':
    timeMultiplier = 0;
    runGame();
    drawPauseMenu();
    break;
  case 'SETTINGS':
    drawSettingsMenu();
    break;
  case 'TUTORIAL':
    drawTutorial();
    break;
  }

  pop();
}

// --------- PLANET CLASS -------------
class Planet {
  constructor(x, y, r, m, a, orbitCenter = null, orbitRadius = 0, orbitSpeed = 0, orbitAngle = 0, img = null) {
    this.pos = createVector(x, y);
    this.radius = r;
    this.mass = m;
    this.atmosphereRadius = a;
    this.orbitCenter = orbitCenter;
    this.orbitRadius = orbitRadius;
    this.orbitSpeed = orbitSpeed;
    this.orbitAngle = orbitAngle;
    this.orbiting = orbitCenter !== null;
    this.moons = [];
    this.radiusSOI = this.calculateSOI();
    this.img = img;
  }

  clone(orbitCenter = null) {
    // Create an exact clone of this to be used in a simulation
    let cloned = new Planet(
      this.pos.x, 
      this.pos.y, 
      this.radius, 
      this.mass, 
      this.atmosphereRadius, 
      orbitCenter, 
      this.orbitRadius, 
      this.orbitSpeed, 
      this.orbitAngle
    );
    
    // Clone moons recursively
    for (let moon of this.moons) {
      let clonedMoon = moon.clone(this);
      clonedMoon.orbitCenter = cloned; // Update reference
      cloned.moons.push(clonedMoon);
    }
    
    return cloned;
  }

  calculateSOI() {

    // Find the radius of this planet's sphere of influence
    if (this.orbiting && this.orbitCenter) {
      return this.orbitRadius * Math.pow(this.mass / this.orbitCenter.mass, 2/5);
    }
    return Infinity; // Primary body has infinite SOI
  }

  update(dt) {

    // Travel along circular orbit
    if (this.orbiting && this.orbitCenter) {
      this.orbitAngle += (this.orbitSpeed / this.orbitRadius) * dt;
      this.pos.x = this.orbitCenter.pos.x + cos(this.orbitAngle) * this.orbitRadius;
      this.pos.y = this.orbitCenter.pos.y + sin(this.orbitAngle) * this.orbitRadius;
    }

    this.radiusSOI = this.calculateSOI();

    for (let moon of this.moons) {
      moon.update(dt);
    }
  }

  findOrbitMovement(dt){
    
    // Find how much the planet moved over the last time step
    if (this.orbiting){
      let tempOrbitAngle = this.orbitAngle - (this.orbitSpeed / this.orbitRadius) * dt;
      let x = this.orbitCenter.pos.x + cos(tempOrbitAngle) * this.orbitRadius;
      let y = this.orbitCenter.pos.y + sin(tempOrbitAngle) * this.orbitRadius;
      let oldPos = createVector(x, y);

      x = this.orbitCenter.pos.x + cos(this.orbitAngle) * this.orbitRadius;
      y = this.orbitCenter.pos.y + sin(this.orbitAngle) * this.orbitRadius;
      let pos = createVector(x, y);

      let movement = p5.Vector.sub(pos, oldPos);

      movement.add(this.orbitCenter.findOrbitMovement(dt));

      return movement;
    }
  }

  moveSystem(offset) {

    // Move this planet and all its moons by an offset vector
    this.pos.add(offset);
    for (let moon of this.moons) {
      moon.moveSystem(offset);
    }
  }

  draw() {
    // Planet body
    imageMode(CENTER)
    fill(100, 100, 100);
    noStroke();
    ellipse(this.pos.x, this.pos.y, this.radius * 2);
    image(this.img, this.pos.x, this.pos.y, this.radius*2, this.radius*2);
    
    // Atmosphere
    noFill();
    stroke(50, 50, 255, 100);
    strokeWeight(1/zoomLevel);
    ellipse(this.pos.x, this.pos.y, this.atmosphereRadius * 2);
    
    // Sphere of influence (only for moons)
    if (this.orbiting) {
      stroke(255, 255, 0, 50);
      ellipse(this.pos.x, this.pos.y, this.radiusSOI * 2);
    }

    for (let moon of this.moons) {
      moon.draw();
    }
  }
}

// --------- ROCKET CLASS -------------
class Rocket {
  constructor(x, y) {
    this.pos = createVector(x, y); // Always stays at 0,0
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.angle = -PI / 2;
    this.thrustPower = 200;
    this.fuel = startingFuel;
    this.landed = false;
    this.currentSOI = earth;
  }

  findSOI(pos, planetSystem) {
    // Start with the primary body
    let currentSOI = planetSystem[0];
    
    // Check all moons recursively
    currentSOI = this.checkMoonsSOI(pos, planetSystem[0], currentSOI);
  
    return currentSOI;
  }
  
  checkMoonsSOI(pos, planet, currentSOI) {

    // Find which sphere of influence the rocket is in
    for (let moon of planet.moons) {
      if (p5.Vector.dist(pos, moon.pos) < moon.radiusSOI) {
        currentSOI = moon;

        // Recursively check moon's moons
        currentSOI = this.checkMoonsSOI(pos, moon, currentSOI);
      }
    }
    return currentSOI;
  }

  calculateGravitationalAcceleration(pos, planetSystem) {

    // Calculate the gravitational force acting on the rocket from the primary body
    let acceleration = createVector(0, 0);
    let dominantBody = this.findSOI(pos, planetSystem);
    
    // Apply gravity from the dominant body
    let force = p5.Vector.sub(dominantBody.pos, pos);
    let distance = force.mag();
    
    if (distance > dominantBody.radius) {
      let strength = (G * dominantBody.mass) / (distance * distance); // Newton's equation
      force.setMag(strength);
      acceleration.add(force);
    }
    
    return acceleration;
  }

  applyAtmosphereDrag(planet, dt) {

    // Apply simplified drag 
    let distance = p5.Vector.dist(this.pos, planet.pos);
    if (distance < planet.atmosphereRadius) {
      let dragStrength = map(distance, planet.radius, planet.atmosphereRadius, 0.1, 0);
      let drag = this.vel.copy().mult(-dragStrength * dt);
      this.acc.add(drag);
    }
  }

  update(dt) {

    // If landed keep rocket on surface of the planet
    if (this.landed || dt === 0) {
      let altitide = p5.Vector.dist(rocket.pos, rocket.currentSOI.pos) - rocket.currentSOI.radius;
      if (altitide < 0){
        let angle = this.currentSOI.pos.copy().heading();
        let offset = createVector(altitide, 0);
        offset.setHeading(angle);
        planets[0].moveSystem(offset);

      }
      return;
    }

    this.currentSOI = this.findSOI(this.pos, planets, true); // find the current dominat body
    
    // Reset acceleration
    this.acc.mult(0);
    
    // Apply gravitational acceleration
    let gravityAcc = this.calculateGravitationalAcceleration(this.pos, planets);
    this.acc.add(gravityAcc);

    // Apply atmospheric drag
    this.applyAtmosphereDrag(this.currentSOI, dt);

    // Handle input
    if (keyIsDown(LEFT_ARROW)) {
      this.angle -= 0.05 * dt;
    }
    if (keyIsDown(RIGHT_ARROW)) {
      this.angle += 0.05 * dt;
    }
    if (keyIsDown(UP_ARROW) && this.fuel > 0) {

      // Play the rocket sound
      if (!rocketSound.playing){
        rocketSound.play();
      }
      this.applyThrust();
      this.fuel -= 0.2 * dt;
    }
    else {
      rocketSound.stop(); // stop the sound when not accelerating
    }

    // Calculate velocity change
    let deltaV = p5.Vector.mult(this.acc, dt);
    this.vel.add(deltaV);
    
    // Instead of moving the rocket, move all planets in the opposite direction
    let displacement = p5.Vector.mult(this.vel, dt);
    let oppositeDisplacement = p5.Vector.mult(displacement, -1);
    
    // Move all planetary systems
    for (let planet of planets) {
      planet.moveSystem(oppositeDisplacement);
    }
    
  }

  applyThrust() {
    let force = p5.Vector.fromAngle(this.angle).mult(this.thrustPower);
    this.acc.add(force);
  }

  draw(x = 0, y = 0, UI = false) {

    // Draw the rocket
    push();
    imageMode(CORNERS);
    translate(x, y);
    rotate(this.angle + HALF_PI);
    if (UI) translate(0, 25); // Center the rocket for the UI
    noStroke();
  
    // Thrust visualization
    if (keyIsDown(UP_ARROW)) {
      image(rocketImage.thrust, -15, -55, 15, 20);
    }
    else{
      image(rocketImage.noThrust, -15, -55, 15, 20); // not using thrust
    }
    
    pop();
  }

  checkLanding() {
    if (!this.currentSOI) return;
    
    let distance = p5.Vector.dist(this.pos, this.currentSOI.pos); // distance from planet
    if (distance <= this.currentSOI.radius) { // Below the surface?
      this.landed = true;
      this.vel.set(0, 0);
    }
  }

  takeOff() {
    if (this.landed && keyIsDown(UP_ARROW)) {
      this.landed = false;
      // Give initial upward velocity
      let upward = p5.Vector.sub(this.pos, this.currentSOI.pos).normalize().mult(10);
      this.vel.add(upward);
    }
  }

  simulateFuture(){

    // Create simulation state
    let simVel = this.vel.copy();
    let simPlanets = this.clonePlanetSystem(planets);
    
    // Track trajectory points relative to current world state
    let simStates = [];
    let trajectoryPoints = [];
    trajectoryPoints.push(createVector(0, 0)); // Start at rocket position
    
    let trajectoryDt = 5; // Larger time step for trajectory
    
    let dominantBody = this.findSOI(createVector(0, 0), simPlanets);

    // Store initial planet positions to calculate relative movement
    let initialPlanetPosition = dominantBody.pos.copy();
    
    for (let step = 0; step < maxSteps; step++) {
      
      // Update planet positions in simulation
      for (let planet of simPlanets) {
        planet.update(trajectoryDt);
      }

      // Adjust for orbits
      let offset = dominantBody.findOrbitMovement(trajectoryDt) || createVector(0, 0);
      offset.mult(-1);
      simPlanets[0].moveSystem(offset);

      // Calculate acceleration using same method as main simulation
      let acceleration = this.calculateGravitationalAcceleration(createVector(0, 0), simPlanets);
      
      // Calculate velocity change
      let deltaV = p5.Vector.mult(acceleration, trajectoryDt);
      simVel.add(deltaV);
      
      // Calculate how much the world would move
      let displacement = p5.Vector.mult(simVel, trajectoryDt);
      let oppositeDisplacement = p5.Vector.mult(displacement, -1);
      
      // Move all planetary systems in simulation
      for (let planet of simPlanets) {
        planet.moveSystem(oppositeDisplacement);
      }

      simStates.push(simPlanets);
      
      // Calculate trajectory point relative to Earth's movement
      let planetMovement = p5.Vector.sub(initialPlanetPosition, dominantBody.pos);
      let trajectoryPoint = planetMovement.copy();
      
      // Stop conditions
      let currentSOI = this.findSOI(createVector(0, 0), simPlanets);
      if (p5.Vector.dist(createVector(0, 0), currentSOI.pos) < currentSOI.radius) {
        break; // Hit surface
      }
      
      if (step > 100) {
        // Check if we've completed an orbit
        if (p5.Vector.dist(trajectoryPoint, createVector(0, 0)) < 10000) {
          trajectoryPoints.push(trajectoryPoint);
          trajectoryPoint.set(0, 0);
          trajectoryPoints.push(trajectoryPoint);
          break;
        }
      }
      
      trajectoryPoints.push(trajectoryPoint);
    }

    return trajectoryPoints;
  }

  drawTrajectory() {
    
    let trajectoryPoints = this.simulateFuture();
    
    // Draw the trajectory
    if (trajectoryPoints.length > 1) {
      stroke(255, 255, 0, 120);
      noFill();
      strokeWeight(2/zoomLevel);
      beginShape();
      for (let point of trajectoryPoints) {
        vertex(point.x, point.y);
      }
      endShape();
    }
  }
  
  clonePlanetSystem(originalPlanets) {

    // Create a duplicate of the system
    let clonedPlanets = [];
    for (let planet of originalPlanets) {
      clonedPlanets.push(planet.clone());
    }
    return clonedPlanets;
  }

}

function drawMainMenu() {
  
  // Title
  drawTitle();
  
  // Menu options
  drawMenuOptions();
  
  // Footer info
  drawMenuFooter();
  
  // Handle menu transitions
  if (menuTransition > 0) {
    menuTransition -= 0.05;
    fill(0, 0, 0, menuTransition * 255);
    rect(0, 0, width, height);
  }
}

function drawTitle() {
  push();
  
  // Main title
  fill(MENU_COLORS.accent[0], MENU_COLORS.accent[1], MENU_COLORS.accent[2]);
  textAlign(CENTER, CENTER);
  textSize(width * 0.08);
  textStyle(BOLD);
  text("ORBITAL NAVIGATOR", width / 2, height * 0.25);
  
  // Subtitle
  fill(MENU_COLORS.text[0], MENU_COLORS.text[1], MENU_COLORS.text[2], 180);
  textSize(width * 0.02);
  textStyle(NORMAL);
  text("Space Exploration Simulator", width / 2, height * 0.32);
  
  // Animated elements around title
  let pulseSize = sin(frameCount * 0.05) * 10 + 20;
  noFill();
  stroke(MENU_COLORS.primary[0], MENU_COLORS.primary[1], MENU_COLORS.primary[2], 100);
  strokeWeight(2);
  ellipse(width / 2, height * 0.32, pulseSize * 20, pulseSize * 5);
  
  pop();
}

function drawMenuOptions() {
  push();
  
  let startY = height * 0.5;
  let spacing = height * 0.08;
  
  textAlign(CENTER, CENTER);
  
  for (let i = 0; i < menuOptions.length; i++) {
    let y = startY + i * spacing;
    let isSelected = (i === menuSelection);
    
    // Selection indicator
    if (isSelected) {
      // Glow effect
      fill(MENU_COLORS.selected[0], MENU_COLORS.selected[1], MENU_COLORS.selected[2], 50);
      noStroke();
      ellipse(width / 2, y, 300, 50);
      
      // Arrow indicators
      fill(MENU_COLORS.accent[0], MENU_COLORS.accent[1], MENU_COLORS.accent[2]);
      textSize(width * 0.02);
      text("►", width / 2 - textSize(menuOptions[menuSelection])*menuOptions[menuSelection].length/2.5, y);
      text("◄", width / 2 + textSize(menuOptions[menuSelection])*menuOptions[menuSelection].length/2.5, y);
    }
    
    // Menu text
    if (isSelected) {
      fill(MENU_COLORS.selected[0], MENU_COLORS.selected[1], MENU_COLORS.selected[2]);
      textSize(width * 0.03);
    } else {
      fill(MENU_COLORS.text[0], MENU_COLORS.text[1], MENU_COLORS.text[2]);
      textSize(width * 0.025);
    }
    
    text(menuOptions[i], width / 2, y);
  }
  
  pop();
}

function drawMenuFooter() {
  push();
  
  fill(MENU_COLORS.text[0], MENU_COLORS.text[1], MENU_COLORS.text[2], 120);
  textAlign(CENTER, CENTER);
  textSize(width * 0.015);
  
  text("Use ↑↓ to navigate • ENTER to select • ESC to exit", width / 2, height * 0.9);
  
  pop();
}

function drawPauseMenu() {
  // Semi-transparent overlay
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  
  // Pause menu box
  fill(20, 20, 40);
  stroke(MENU_COLORS.primary[0], MENU_COLORS.primary[1], MENU_COLORS.primary[2]);
  strokeWeight(2);
  rectMode(CENTER);
  rect(width / 2, height / 2, 300, 200);
  
  // Pause text
  fill(MENU_COLORS.text[0], MENU_COLORS.text[1], MENU_COLORS.text[2]);
  textAlign(CENTER, CENTER);
  textSize(32);
  text("PAUSED", width / 2, height / 2 - 40);
  
  textSize(16);
  text("Press ESC to resume", width / 2, height / 2);
  text("Press M to return to menu", width / 2, height / 2 + 30);
}

function drawSettingsMenu() {
  
  // Header
  fill(MENU_COLORS.text[0], MENU_COLORS.text[1], MENU_COLORS.text[2]);
  textAlign(CENTER, CENTER);
  textSize(48);
  text("SETTINGS", width / 2, height / 2 - 100);
  
  // Settings (Can't be changed by user)
  textSize(24);
  text(`Trajectory Steps: ${maxSteps}`, width / 2, height / 2 - 20);
  text("Starting Planet: Earth", width / 2, height / 2 + 20);
  text("Controls: Arrow Keys", width / 2, height / 2 + 60);
  text("Thrust: 200", width / 2, height / 2 + 100);
  text(`Fuel: ${startingFuel}`, width / 2, height / 2 + 140);
  
  // Footer
  textSize(16);
  text("Press ESC to return to menu", width / 2, height / 2 + 200);
}

function drawTutorial() {
  
  // Header
  fill(MENU_COLORS.text[0], MENU_COLORS.text[1], MENU_COLORS.text[2]);
  textAlign(CENTER, CENTER);
  textSize(48);
  text("TUTORIAL", width / 2, height / 2 - 150);
  
  // Help info
  textSize(20);
  text("• Use arrow keys to steer and thrust", width / 2, height / 2 - 80);
  text("• Mouse wheel to zoom in/out", width / 2, height / 2 - 50);
  text("• Number keys 0-9 control time speed", width / 2, height / 2 - 20);
  text("• Watch your speed and altitude", width / 2, height / 2 + 10);
  text("• Yellow line shows your trajectory", width / 2, height / 2 + 40);
  text("• Press ESC to pause", width / 2, height / 2 + 70);
  
  // Footer
  textSize(16);
  text("Press ESC to return to menu", width / 2, height / 2 + 150);
}

function initializeSystem(){

  planets = []; // reset planets

  // Initialize every planet
  sun = new Planet(0,
    0,
    SUN.radius,
    SUN.mass,
    SUN.radius,
    null,
    0,
    0,
    0,
    SUN.image
  );
  
  earth = new Planet(
    sun.pos.x + EARTH.orbitRadius,
    sun.pos.y, EARTH.radius,
    EARTH.mass,
    EARTH.radius + 70000,
    sun,
    EARTH.orbitRadius,
    EARTH.orbitSpeed,
    0,
    EARTH.image
  );
  sun.moons.push(earth);
  
  moon = new Planet(
    earth.pos.x + MOON.orbitRadius, 
    earth.pos.y, 
    MOON.radius, 
    MOON.mass, 
    0, 
    earth, 
    MOON.orbitRadius, 
    MOON.orbitSpeed,
    0,
    MOON.image
  );
  earth.moons.push(moon);

  mercury = new Planet(
    sun.pos.x + MERCURY.orbitRadius,
    sun.pos.y, MERCURY.radius,
    MERCURY.mass,
    0,
    sun,
    MERCURY.orbitRadius,
    MERCURY.orbitSpeed,
    MERCURY.orbitAngle,
    MERCURY.image
  );
  sun.moons.push(mercury);

  venus = new Planet(
    sun.pos.x + VENUS.orbitRadius,
    sun.pos.y, VENUS.radius,
    VENUS.mass,
    0,
    sun,
    VENUS.orbitRadius,
    VENUS.orbitSpeed,
    VENUS.orbitAngle,
    VENUS.image
  );
  sun.moons.push(venus);
  
  mars = new Planet(
    sun.pos.x + MARS.orbitRadius,
    sun.pos.y, MARS.radius,
    MARS.mass,
    0,
    sun,
    MARS.orbitRadius,
    MARS.orbitSpeed,
    MARS.orbitAngle,
    MARS.image
  );
  sun.moons.push(mars);

  jupiter = new Planet(
    sun.pos.x + JUPITER.orbitRadius,
    sun.pos.y, JUPITER.radius,
    JUPITER.mass,
    0,
    sun,
    JUPITER.orbitRadius,
    JUPITER.orbitSpeed,
    JUPITER.orbitAngle,
    JUPITER.image
  );
  sun.moons.push(jupiter);

  saturn = new Planet(
    sun.pos.x + SATURN.orbitRadius,
    sun.pos.y, SATURN.radius,
    SATURN.mass,
    0,
    sun,
    SATURN.orbitRadius,
    SATURN.orbitSpeed,
    SATURN.orbitAngle,
    SATURN.image
  );
  sun.moons.push(saturn);

  uranus = new Planet(
    sun.pos.x + URANUS.orbitRadius,
    sun.pos.y, URANUS.radius,
    URANUS.mass,
    0,
    sun,
    URANUS.orbitRadius,
    URANUS.orbitSpeed,
    URANUS.orbitAngle,
    URANUS.image
  );
  sun.moons.push(uranus);

  neptune = new Planet(
    sun.pos.x + NEPTUNE.orbitRadius,
    sun.pos.y, NEPTUNE.radius,
    NEPTUNE.mass,
    0,
    sun,
    NEPTUNE.orbitRadius,
    NEPTUNE.orbitSpeed,
    NEPTUNE.orbitAngle,
    NEPTUNE.image
  );
  sun.moons.push(neptune);

  planets.push(sun);
  
  // Rocket stays at origin
  rocket = new Rocket(0, 0);
  
  setupPlanets(planets, startingPlanet); // Move planets to correct starting position
}

function runGame(){

  // Update time step
  restrainTimeStep();
  currentTimeStep = baseTimeStep * timeMultiplier;
  
  // Camera centered on rocket (0,0)
  push();
  translate(width / 2, height / 2);
  scale(zoomLevel);
  
  // How much did the current SOI planet move
  let offset = rocket.currentSOI.findOrbitMovement(currentTimeStep) || createVector(0, 0);
  offset.mult(-1);
  
  // Update and draw everything
  planets[0].moveSystem(offset);
  for (let planet of planets) {
    planet.update(currentTimeStep);
    planet.draw();
  }
  
  rocket.update(currentTimeStep);
  rocket.draw();
  rocket.drawTrajectory();
  rocket.checkLanding();
  rocket.takeOff();

  pop();

  drawUI();
}

function drawUI(){
  // UI display
  fill('white');
  strokeWeight(1);
  textSize(16);
  text(`Speed: ${rocket.vel.mag().toFixed(1)} m/s`, 10, 30);
  text(`Time Multiplier: ${timeMultiplier.toFixed(1)}x`, 10, 50);
  text(`Altitude: ${(p5.Vector.dist(rocket.pos, rocket.currentSOI.pos) - rocket.currentSOI.radius).toFixed(0)} m`, 10, 70);
  text(`Controls: 0-9 for speed, Mouse wheel for zoom, Arrows to steer/thrust`, 10, 90);
  text(`Press ESC to pause`, 10, 110);
  rocket.draw(100, 170, true); // Rotation indicator
}

function setupPlanets(planets, startPlanet){

  // Move every planet so that starting location is at (0, 0), where the rocket is
  let startPos = createVector(startPlanet.orbitRadius, 0).add(0, -startPlanet.radius + 10);
  for (let planet of planets){
    planet.pos.sub(startPos);
  }
}

function restrainTimeStep(){
  
  // Don't let the time multiplier be high when near a planet because high speed impacts break things
  let altitide = p5.Vector.dist(rocket.pos, rocket.currentSOI.pos) - rocket.currentSOI.radius;
  if (altitide < rocket.currentSOI.radius * (1/10)){
    timeMultiplier = min(timeMultiplier, 1);
  }
}

function selectMenuOption() {
  menuTransition = 1.0; // Menu fade

  buttonSound.play();
  
  switch(menuSelection) {
    case 0:
      gameState = 'GAME';
      timeMultiplier = 1;
      initializeSystem(); // Initialize the game when starting
      break;
    case 1:
      gameState = 'SETTINGS';
      break;
    case 2:
      gameState = 'TUTORIAL';
      break;
  }
}

function keyPressed() {

  // Which handler should be used for the current game state
  if (gameState === 'MENU') {
    handleMenuInput();
  } else if (gameState === 'GAME') {
    handleGameInput();
  } else if (gameState === 'PAUSED') {
    handlePauseInput();
  } else if (gameState === 'SETTINGS' || gameState === 'TUTORIAL') {
    if (keyCode === ESCAPE) {
      gameState = 'MENU';
    }
  }
}

function handleMenuInput() {
  if (keyCode === UP_ARROW) {
    menuSelection = (menuSelection - 1 + menuOptions.length) % menuOptions.length;
  } else if (keyCode === DOWN_ARROW) {
    menuSelection = (menuSelection + 1) % menuOptions.length;
  } else if (keyCode === ENTER) {
    selectMenuOption();
  } else if (keyCode === ESCAPE) {
    // Nothing
  }
}

function handlePauseInput() {
  if (keyCode === ESCAPE) {
    timeMultiplier = 1;
    gameState = 'GAME';
  } else if (key === 'm' || key === 'M') {
    gameState = 'MENU';
  }
}

function handleGameInput() {
  if (keyCode === ESCAPE) {
    gameState = 'PAUSED';
  } else {
    // Time multiplier handling
    if (key === '1') timeMultiplier = 0.1;
    else if (key === '2') timeMultiplier = 0.5;
    else if (key === '3') timeMultiplier = 1.0;
    else if (key === '4') timeMultiplier = 2.0;
    else if (key === '5') timeMultiplier = 5.0;
    else if (key === '6') timeMultiplier = 10.0;
    else if (key === '7') timeMultiplier = 50.0;
    else if (key === '8') timeMultiplier = 100.0;
    else if (key === '9') timeMultiplier = 500.0;
    else if (key === '0') timeMultiplier = 0.0;
    
    restrainTimeStep();
  }
}

function mouseWheel(event) {

  // Zoom control
  zoomLevel *= event.delta > 0 ? 0.8 : 1.25;
  zoomLevel = constrain(zoomLevel, ZOOM_MIN, ZOOM_MAX);
}

