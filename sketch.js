let G = 6.67 * 10**-11;
let planets = [];
let stations = [];
let rocket;
let zoomLevel = 1; // New zoom variable

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  let planet = new Planet(width / 2, height / 2, 6.37 * 10**6, 5.98 * 10**24, 6.37 * 10**6 + 70000);
  planets.push(planet);
  
  // let moon = new Planet(width / 2 + 400, height / 2, 30, 1000, 80, planet, 500, 0.02);
  // planets.push(moon);
  
  rocket = new Rocket(planet.pos.x, planet.pos.y - planet.radius - 10);

  let station = new SpaceStation(width / 2 + 300, height / 2 - 200);
  stations.push(station);
}

function draw() {
  background(0);
  fill('red');
  strokeWeight(2);
  text(rocket.vel.mag(), 0, 50);
  
  translate(width / 2 - rocket.pos.x * zoomLevel, height / 2 - rocket.pos.y * zoomLevel);
  scale(zoomLevel); // Apply zoom
  
  for (let planet of planets) {
    planet.update();
    planet.draw();
  }

  for (let station of stations) {
    station.draw();
  }

  rocket.draw();
  rocket.drawTrajectory();
  rocket.drawOrbitAssist();
  rocket.update();
  rocket.checkLanding();
  rocket.takeOff();
  rocket.checkDocking();
}

// Zoom control
function mouseWheel(event) {
  zoomLevel *= event.delta > 0 ? 0.5 : 2; // Zoom in/out smoothly
  zoomLevel = constrain(zoomLevel, 0.00000001, 3); // Set zoom limits
}

// --------- PLANET CLASS -------------
class Planet {
  constructor(x, y, r, m, a, orbitCenter = null, orbitRadius = 0, orbitSpeed = 0) {
    this.pos = createVector(x, y);
    this.radius = r;
    this.mass = m;
    this.atmosphereRadius = a;
    this.orbitCenter = orbitCenter;
    this.orbitRadius = orbitRadius;
    this.orbitSpeed = orbitSpeed;
    this.orbitAngle = random(TWO_PI);
    this.orbiting = orbitCenter !== null;
  }

  update() {
    if (this.orbiting) {
      this.orbitAngle += this.orbitSpeed;
      this.pos.x = this.orbitCenter.pos.x + cos(this.orbitAngle) * this.orbitRadius;
      this.pos.y = this.orbitCenter.pos.y + sin(this.orbitAngle) * this.orbitRadius;
    }
  }

  draw() {
    fill(100, 100, 255);
    ellipse(this.pos.x, this.pos.y, this.radius * 2);
    noFill();
    stroke(50, 50, 255, 100);
    ellipse(this.pos.x, this.pos.y, this.atmosphereRadius * 2);
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
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.angle = -PI / 2;
    this.thrustPower = 100;
    this.fuel = Infinity;
    this.landed = false;
  }

  applyGravity(planet) {
    let force = p5.Vector.sub(planet.pos, this.pos);
    let distance = force.mag(); 
    
    // Only avoid division by zero
    if (distance < planet.radius) {
      return; // Skip if inside planet
    }
    
    let strength = (G * planet.mass) / (distance * distance);
    force.setMag(strength);
    this.acc.add(force);
  }

  applyAtmosphereDrag(planet) {
    let distance = p5.Vector.dist(this.pos, planet.pos);
    if (distance < planet.atmosphereRadius) {
      let dragStrength = map(distance, planet.radius, planet.atmosphereRadius, 0.05, 0);
      let drag = this.vel.copy().mult(-dragStrength);
      this.acc.add(drag);
    }
  }

  update() {
    if (this.landed) {
      return;
    }

    for (let planet of planets) {
      this.applyGravity(planet);
      this.applyAtmosphereDrag(planet);
    }

    if (keyIsDown(LEFT_ARROW)) {
      this.angle -= 0.05;
    }
    if (keyIsDown(RIGHT_ARROW)) {
      this.angle += 0.05;
    }
    if (keyIsDown(UP_ARROW) && this.fuel > 0) {
      this.applyThrust();
      this.fuel -= 0.2;
    }

    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  applyThrust() {
    let force = p5.Vector.fromAngle(this.angle).mult(this.thrustPower);
    this.acc.add(force);
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    rotate(HALF_PI);
    fill(255, 0, 0);
    triangle(-10, 15, 10, 15, 0, -15);
    pop();
  }

  checkLanding() {
    for (let planet of planets) {
      let distance = p5.Vector.dist(this.pos, planet.pos);
      if (distance < planet.radius) {
        if (this.vel.mag() < 2) {
          this.landed = true;
          this.vel.set(0, 0);
        } 
        else {
          console.log("Crashed!");
          this.vel.set(0, 0);
          this.landed = false;
        }
      }
    }
  }

  takeOff() {
    if (this.landed && keyIsDown(UP_ARROW)) {
      this.landed = false;
      this.vel.set(0, -2);
    }
  }

  drawOrbitAssist() {
    let planet = planets[0];
    let speed = this.vel.mag();
    let altitude = p5.Vector.dist(this.pos, planet.pos) - planet.radius;

    if (speed > 4 && altitude > planet.radius * 1.5) {
      push();
      stroke(0, 0, 255);
      noFill();
      ellipse(planet.pos.x, planet.pos.y, altitude * 2);
      pop();
    }
  }

  drawTrajectory() {
    // Create temporary variables for simulation
    let tempPos = this.pos.copy();
    let tempVel = this.vel.copy();
    let tempAcc = createVector(0, 0);
    
    // Track positions of orbiting bodies
    let futurePlanetPositions = planets.map((p, index) => ({
      pos: p.pos.copy(),
      mass: p.mass,
      radius: p.radius,
      orbiting: p.orbiting,
      orbitCenter: p.orbitCenter ? { index: planets.indexOf(p.orbitCenter) } : null,
      orbitRadius: p.orbitRadius,
      orbitSpeed: p.orbitSpeed,
      orbitAngle: p.orbitAngle
    }));
    
    // Set limits for the trajectory prediction
    let maxSteps = 50000;
    let maxDistance = planets[0].radius * 30;
    
    stroke(255, 255, 0);
    noFill();
    strokeWeight(1/zoomLevel);
    beginShape();
    
    // Use Velocity Verlet integration for better energy conservation
    let dt = 5.00;
    
    // Draw trajectory
    for (let steps = 0; steps < maxSteps; steps++) {
      // Update positions of orbiting bodies
      for (let i = 0; i < futurePlanetPositions.length; i++) {
        let planet = futurePlanetPositions[i];
        if (planet.orbiting) {
          planet.orbitAngle += planet.orbitSpeed;
          let centerPlanet = futurePlanetPositions[planet.orbitCenter.index];
          planet.pos.x = centerPlanet.pos.x + cos(planet.orbitAngle) * planet.orbitRadius;
          planet.pos.y = centerPlanet.pos.y + sin(planet.orbitAngle) * planet.orbitRadius;
        }
      }
      
      // Velocity Verlet integration
      // Calculate current acceleration
      let acc = this.calculateAcceleration(tempPos, futurePlanetPositions);
      
      // Update position: x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt^2
      let halfAccStep = p5.Vector.mult(acc, 0.5 * dt * dt);
      let velStep = p5.Vector.mult(tempVel, dt);
      tempPos.add(p5.Vector.add(velStep, halfAccStep));
      
      // Calculate new acceleration
      let newAcc = this.calculateAcceleration(tempPos, futurePlanetPositions);
      
      // Update velocity: v(t+dt) = v(t) + 0.5*[a(t) + a(t+dt)]*dt
      let avgAcc = p5.Vector.add(acc, newAcc).mult(0.5 * dt);
      tempVel.add(avgAcc);
      
      // Add point to trajectory
      vertex(tempPos.x, tempPos.y);
      
      // Check if we've completed an orbit or close to it
      if (steps > 100 && p5.Vector.dist(tempPos, this.pos) < 10/min(zoomLevel, 1)) {
        break;
      }
      
      // Stop if going too far from the main planet or hitting the planet
      if (p5.Vector.dist(tempPos, planets[0].pos) > maxDistance || p5.Vector.dist(tempPos, planets[0].pos) < planets[0].radius) {
        break;
      }
    }
    
    endShape();
  }

  // Helper method to calculate acceleration at a point
  calculateAcceleration(position, planetsList) {
    let acceleration = createVector(0, 0);
    
    for (let planet of planetsList) {
      let force = p5.Vector.sub(planet.pos, position);
      let distance = force.mag();
      
      // Don't constrain distance for trajectory calculation
      // Only avoid division by zero
      if (distance < planet.radius) {
        continue;
      }
      
      let strength = (G * planet.mass) / (distance * distance);
      force.setMag(strength);
      acceleration.add(force);
    }
    
    return acceleration;
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