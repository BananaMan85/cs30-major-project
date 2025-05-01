let G = 0.5;
let planets = [];
let stations = [];
let rocket;
let zoomLevel = 1; // New zoom variable

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  let planet = new Planet(width / 2, height / 2, 100, 5000, 200);
  planets.push(planet);
  
  // let moon = new Planet(width / 2 + 400, height / 2, 30, 1000, 80, planet, 500, 0.02);
  // planets.push(moon);
  
  rocket = new Rocket(planet.pos.x, planet.pos.y - planet.radius - 10);

  let station = new SpaceStation(width / 2 + 300, height / 2 - 200);
  stations.push(station);
}

function draw() {
  background(0);
  
  translate(width / 2 - rocket.pos.x * zoomLevel, height / 2 - rocket.pos.y * zoomLevel);
  scale(zoomLevel); // Apply zoom
  
  for (let planet of planets) {
    planet.update();
    planet.draw();
  }

  for (let station of stations) {
    station.draw();
  }

  rocket.update();
  rocket.checkLanding();
  rocket.takeOff();
  rocket.draw();
  rocket.drawTrajectory();
  rocket.drawOrbitAssist();
  rocket.checkDocking();
}

// Zoom control
function mouseWheel(event) {
  zoomLevel *= event.delta > 0 ? 0.9 : 1.1; // Zoom in/out smoothly
  zoomLevel = constrain(zoomLevel, 0.1, 3); // Set zoom limits
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
    this.thrustPower = 0.2;
    this.fuel = 100;
    this.landed = false;
  }

  applyGravity(planet) {
    let force = p5.Vector.sub(planet.pos, this.pos);
    let distance = constrain(force.mag(), planet.radius, 1000);
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
    Rocket.prototype.drawTrajectory = function () {
      let tempPos = this.pos.copy();
      let tempVel = this.vel.copy();
      let tempAcc = createVector(0, 0);
      let futureMoons = planets.map(p => p.orbiting ? Object.assign({}, p) : null);
      let maxDistance = planets[0].radius * 20; // Stop if too far from main planet
    
      stroke(255, 255, 0);
      noFill();
      beginShape();
    
      let lastClosePos = tempPos.copy();
      let loopCompleted = false;
      let steps = 0;
    
      while (!loopCompleted && steps < 5000) {
        tempAcc.set(0, 0);
    
        for (let moon of futureMoons) {
          if (moon) {
            moon.orbitAngle += moon.orbitSpeed;
            moon.pos.x = moon.orbitCenter.pos.x + cos(moon.orbitAngle) * moon.orbitRadius;
            moon.pos.y = moon.orbitCenter.pos.y + sin(moon.orbitAngle) * moon.orbitRadius;
          }
        }
    
        for (let planet of planets) {
          let force = p5.Vector.sub(planet.pos, tempPos);
          let distance = constrain(force.mag(), planet.radius, 1000);
          let strength = (G * planet.mass) / (distance * distance);
          force.setMag(strength);
          tempAcc.add(force);
        }
    
        tempVel.add(tempAcc);
        tempPos.add(tempVel);
        vertex(tempPos.x, tempPos.y);
        steps++;
    
        // Check if it's looping back close to the original position
        if (p5.Vector.dist(tempPos, this.pos) < 10 && steps > 50) {
          loopCompleted = true;
        }
    
        // Stop if going too far from the main planet
        if (p5.Vector.dist(tempPos, planets[0].pos) > maxDistance) {
          break;
        }
      }
      endShape();
    };    
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
