const G = 6.67 * 10**-11; // Gravitational constant

const SUN = {
  radius: 6.96265 * 10 ** 8,
  mass: 1.9891 * 10 ** 30,
};

const EARTH = {
  radius: 6.37 * 10**6,
  mass: 5.98 * 10**24,
  orbitRadius: 1.496 * 10 ** 11,
  orbitSpeed: 2.978 * 10 ** 4,
};
const MOON = {
  radius: 1.7374 * 10 ** 6,
  mass: 7.34767309 * 10 ** 22,
  orbitRadius: 3.844 * 10 ** 8,
  orbitSpeed: 1.022 * 10 ** 3
};

const ZOOM_MIN = 0.0000000000001;
const ZOOM_MAX = 3;

let sun, earth, moon;
let planets = [];
let stations = [];
let rocket;
let zoomLevel = 1;

// Time control variables
let baseTimeStep = 1.0; // Base time step in seconds
let timeMultiplier = 1.0; // Speed multiplier (1x, 2x, 0.5x, etc.)
let currentTimeStep = 1.0; // Actual time step used
let totalTime = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);

  sun = new Planet(0, 0, SUN.radius, SUN.mass, SUN.radius);
  

  // Earth starts below the rocket (rocket is at origin)
  earth = new Planet(
    sun.pos.x + EARTH.orbitRadius,
    sun.pos.y, EARTH.radius,
    EARTH.mass,
    EARTH.radius + 70000,
    sun,
    EARTH.orbitRadius,
    EARTH.orbitSpeed);
  sun.moons.push(earth);
  
  moon = new Planet(
    earth.pos.x + MOON.orbitRadius, 
    earth.pos.y, 
    MOON.radius, 
    MOON.mass, 
    0, 
    earth, 
    MOON.orbitRadius, 
    MOON.orbitSpeed
  );
  earth.moons.push(moon);

  planets.push(sun);
  
  // Rocket stays at origin
  rocket = new Rocket(0, 0);
  
  setupPlanets(planets);
}

function draw() {
  background(0);
  
  // Update time step
  currentTimeStep = baseTimeStep * timeMultiplier;
  totalTime += currentTimeStep;
  
  // UI display
  fill('white');
  strokeWeight(1);
  textSize(16);
  text(`Speed: ${rocket.vel.mag().toFixed(1)} m/s`, 10, 30);
  text(`Time Multiplier: ${timeMultiplier.toFixed(1)}x`, 10, 50);
  text(`Altitude: ${(p5.Vector.dist(rocket.pos, rocket.currentSOI.pos) - rocket.currentSOI.radius).toFixed(0)} m`, 10, 70);
  text(`Controls: 1-5 for speed, Mouse wheel for zoom, Arrows to steer/thrust`, 10, 90);
  
  // Camera centered on rocket (which is at 0,0)
  translate(width / 2, height / 2);
  scale(zoomLevel);
  
  // Update and draw everything
  let offset = rocket.currentSOI.findOrbitMovement(currentTimeStep) || createVector(0, 0);
  offset.mult(-1);
  
  planets[0].moveSystem(offset);
  for (let planet of planets) {
    planet.update(currentTimeStep);
    planet.draw();
  }
  
  for (let station of stations) {
    station.draw();
  }
  
  rocket.update(currentTimeStep);
  rocket.draw();
  rocket.drawTrajectory();
  rocket.checkLanding();
  rocket.takeOff();
  rocket.checkDocking();
}

function setupPlanets(planets){
  let startPos = createVector(EARTH.orbitRadius, 0).add(0, -EARTH.radius + 10);
  for (let planet of planets){
    planet.pos.sub(startPos);
    // setupPlanets(planet.moons);
  }
}

// Speed control with number keys
function keyPressed() {
  if (key === '1') timeMultiplier = 0.1;
  else if (key === '2') timeMultiplier = 0.5;
  else if (key === '3') timeMultiplier = 1.0;
  else if (key === '4') timeMultiplier = 2.0;
  else if (key === '5') timeMultiplier = 5.0;
  else if (key === '6') timeMultiplier = 10.0;
  else if (key === '7') timeMultiplier = 50.0;
  else if (key === '8') timeMultiplier = 100.0;
  else if (key === '9') timeMultiplier = 500.0;
  else if (key === '0') timeMultiplier = 0.0; // Pause
}

// Zoom control
function mouseWheel(event) {
  zoomLevel *= event.delta > 0 ? 0.8 : 1.25;
  zoomLevel = constrain(zoomLevel, ZOOM_MIN, ZOOM_MAX);
}

// --------- PLANET CLASS -------------
class Planet {
  constructor(x, y, r, m, a, orbitCenter = null, orbitRadius = 0, orbitSpeed = 0, orbitAngle = 0) {
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
  }

  clone(orbitCenter = null) {
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
    if (this.orbiting && this.orbitCenter) {
      return this.orbitRadius * Math.pow(this.mass / this.orbitCenter.mass, 2/5);
    }
    return Infinity; // Primary body has infinite SOI
  }

  update(dt) {
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

  // Move this planet and all its moons by an offset vector
  moveSystem(offset) {
    this.pos.add(offset);
    for (let moon of this.moons) {
      moon.moveSystem(offset);
    }
  }

  draw() {
    // Planet body
    fill(100, 100, 255);
    noStroke();
    ellipse(this.pos.x, this.pos.y, this.radius * 2);
    
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

// --------- SPACE STATION CLASS -------------
class SpaceStation {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.size = 40;
  }

  draw() {
    fill(200, 200, 200);
    rectMode(CENTER);
    rect(this.pos.x, this.pos.y, this.size, this.size);
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
    this.fuel = Infinity;
    this.landed = false;
    this.currentSOI = earth;
    this.lastSOIChange = millis();
    this.soiChangeCooldown = 100;
  }

  correctCourse(SOI){
    let angle = SOI.findOrbitMovement().copy().heading();
    console.log(angle);
    angle *= -1;
    this.vel.rotate(angle);
  }

  findSOI(pos, planetSystem, allowCourseCorrect = false) {
    // Start with the primary body
    let currentSOI = planetSystem[0];
    
    // Check all moons recursively
    currentSOI = this.checkMoonsSOI(pos, planetSystem[0], currentSOI);
    
    if (allowCourseCorrect && currentSOI.mass !== this.currentSOI.mass && millis() - this.lastSOIChange > this.soiChangeCooldown){
      this.lastSOIChange = millis();
      // this.correctCourse(this.currentSOI);
      console.log('here');
    }

    return currentSOI;
  }
  
  checkMoonsSOI(pos, planet, currentSOI) {
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
    let acceleration = createVector(0, 0);
    let dominantBody = this.findSOI(pos, planetSystem);
    
    // Apply gravity from the dominant body
    let force = p5.Vector.sub(dominantBody.pos, pos);
    let distance = force.mag();
    
    if (distance > dominantBody.radius) {
      let strength = (G * dominantBody.mass) / (distance * distance);
      force.setMag(strength);
      acceleration.add(force);
    }
    
    return acceleration;
  }

  applyAtmosphereDrag(planet, dt) {
    let distance = p5.Vector.dist(this.pos, planet.pos);
    if (distance < planet.atmosphereRadius) {
      let dragStrength = map(distance, planet.radius, planet.atmosphereRadius, 0.1, 0);
      let drag = this.vel.copy().mult(-dragStrength * dt);
      this.acc.add(drag);
    }
  }

  update(dt) {
    if (this.landed || dt === 0) {
      return;
    }

    this.currentSOI = this.findSOI(this.pos, planets, true);
    
    // Reset acceleration
    this.acc.mult(0);
    
    // Apply gravitational acceleration
    let gravityAcc = this.calculateGravitationalAcceleration(this.pos, planets);
    this.acc.add(gravityAcc);

    // Apply atmospheric drag from all bodies
    for (let planet of planets) {
      this.applyAtmosphereDrag(planet, dt);
      for (let moon of planet.moons) {
        this.applyAtmosphereDrag(moon, dt);
      }
    }

    // Handle input
    if (keyIsDown(LEFT_ARROW)) {
      this.angle -= 0.05 * dt;
    }
    if (keyIsDown(RIGHT_ARROW)) {
      this.angle += 0.05 * dt;
    }
    if (keyIsDown(UP_ARROW) && this.fuel > 0) {
      this.applyThrust();
      this.fuel -= 0.2 * dt;
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
    
    // Move all stations
    for (let station of stations) {
      station.pos.add(oppositeDisplacement);
    }
  }

  applyThrust() {
    let force = p5.Vector.fromAngle(this.angle).mult(this.thrustPower);
    this.acc.add(force);
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle + HALF_PI);
    fill(255, 0, 0);
    noStroke();
    triangle(-10, 15, 10, 15, 0, -15);
    
    // Thrust visualization
    if (keyIsDown(UP_ARROW)) {
      fill(255, 100, 0, 150);
      triangle(-5, 15, 5, 15, 0, 25);
    }
    pop();
  }

  checkLanding() {
    if (!this.currentSOI) return;
    
    let distance = p5.Vector.dist(this.pos, this.currentSOI.pos);
    if (distance <= this.currentSOI.radius + 100) { // Small buffer above surface
      if (this.vel.mag() < 5) {
        this.landed = true;
        this.vel.set(0, 0);
        console.log("Landed successfully!");
      } else {
        console.log("Crashed! Impact velocity:", this.vel.mag().toFixed(1), "m/s");
        this.vel.mult(0.1); // Bounce with energy loss
      }
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
    
    let maxSteps = 10000;
    let trajectoryDt = 5; // Larger time step for trajectory
    
    let dominantBody = this.findSOI(createVector(0, 0), simPlanets);

    // Store initial planet positions to calculate relative movement
    let initialPlanetPosition = dominantBody.pos.copy();
    
    for (let step = 0; step < maxSteps; step++) {
      
      // Update planet positions in simulation
      for (let planet of simPlanets) {
        planet.update(trajectoryDt);
      }

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
      trajectoryPoints.push(trajectoryPoint);
      
      // Stop conditions
      let currentSOI = this.findSOI(createVector(0, 0), simPlanets);
      if (p5.Vector.dist(createVector(0, 0), currentSOI.pos) < currentSOI.radius) {
        break; // Hit surface
      }
      
      if (step > 100) {
        // Check if we've completed an orbit
        if (p5.Vector.dist(trajectoryPoint, createVector(0, 0)) < 10000) {
          trajectoryPoint.set(0, 0);
          trajectoryPoints.push(trajectoryPoint);
          break;
        }
      }
      
      // if (p5.Vector.dist(createVector(0, 0), dominantBody.pos) > dominantBody.radius * 100) {
      //   break; // Too far away
      // }
    }

    return {
      points: trajectoryPoints,
      planets: simStates,
    };

  }

  drawTrajectory() {
    
    let trajectoryPoints = this.simulateFuture().points;
    
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
    let clonedPlanets = [];
    for (let planet of originalPlanets) {
      clonedPlanets.push(planet.clone());
    }
    return clonedPlanets;
  }

  checkDocking() {
    for (let station of stations) {
      if (p5.Vector.dist(this.pos, station.pos) < 20 && this.vel.mag() < 1) {
        console.log("Docked Successfully!");
        this.vel.set(0, 0);
      }
    }
  }
}