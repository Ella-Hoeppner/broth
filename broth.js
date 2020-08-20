const DEFAULT_DISPLAY_SETTINGS = {
  canvasSize: 600,
  framerate: 30,
  minimapSize: 0.15,
  minimapBuffer: 0.01,
  actionIconSize: 0.05,
  actionIconBuffer: 0.01,
  pauseIconSize: 0.05,
  pauseIconBuffer: 0.01,
  speedIconSize: 0.05,
  speedIconBuffer: 0.01,
  timestepsPerFrameBase: 2,
  timestepsPerFrameExponent: 2,
  flingPowerFactor: 3,

  zoom: 1,
  zoomFactor: 1.001,
  scrollX: 0.5,
  scrollY: 0.5,
  scrollFactor: 0.5
}

const DEFAULT_SIMULATION_SETTINGS = {
  worldSize: 600,
  timeDelta: 1 / 120,
  drag: 0,

  binderPower: 700,

  controlRange: 20,

  computationCost: 0.1,
  binderRangeEnergyFactor: 0.02,
  energyParticleEnergy: 1,
  reprogramCost: 10,

  batteryDefaultEnergy: 10000,

  mutationChance: 0.15,

  mutationGaussianFactor: 3,
  mutationSizeLambda: 0.8,

  clearDelayTime: 700,

  operations: [{
      name: "t_+",
      args: 2
    },
    {
      name: "t_-",
      args: 2
    },
    {
      name: "t_*",
      args: 2
    },
    {
      name: "t_/",
      args: 2
    },
    {
      name: "t_exp",
      args: 2
    },
    {
      name: "t_sum",
      args: 1
    },
    {
      name: "t_abs",
      args: 1
    },
    {
      name: "t_product",
      args: 1
    },
    {
      name: "t_reverse",
      args: 1
    },
    {
      name: "t_size",
      args: 1
    },
    {
      name: "t_floor",
      args: 1
    },
    {
      name: "t_not",
      args: 1
    },
    {
      name: "t_and",
      args: 2
    },
    {
      name: "t_or",
      args: 2
    },
    {
      name: "t_xor",
      args: 2
    },
    {
      name: "t_concat",
      args: 2
    },
    {
      name: "t_before",
      args: 2
    },
    {
      name: "t_if",
      args: 3
    },
    {
      name: "t_=",
      args: 2
    },
    {
      name: "t_>",
      args: 2
    },
    {
      name: "t_<",
      args: 2
    },
  ]
}

const COLORS = {}

const PARTICLE = {
  control: 0,
  energy: 1,
  binder: 2,
  battery: 3,
  mover: 4
}

const ACTION = {
  createControl: 0,
  createGrabber: 1,
  createBattery: 2,
  createMover: 3,
  createEnergy: 4,
  fling: 5,
  destroyParticle: 6,
  program: 7,
  inspect: 8
}

const ACTION_ROW_SEPARATOR = ACTION.createEnergy

var simulationState = {}
var simulationSettings = null
var displaySettings = null

var selectedActionIndex = 0
var selectedFlingID = -1
var selectedProgramID = -1
var selectedInspectID = -1

var paused = false

var signalFunctionInput = null
var connectionFunctionInput = null
var updateFunctionInput = null
var delayFunctionInput = null
var internalStateInput = null
var delayInput = null

var sexpFunctions = {}

function normalRandom(factor) {
  return factor * Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random())
}

function copyPos(p1, p2) {
  p2.x = p1.x
  p2.y = p1.y
}

function scaleVector(v, f) {
  return {
    x: v.x * f,
    y: v.y * f
  }
}

function tweenVectors(v1, v2, p) {
  return {
    x: v1.x * (1 - p) + v2.x * p,
    y: v1.y * (1 - p) + v2.y * p
  }
}

function addVectors(v1, v2) {
  return {
    x: v1.x + v2.x,
    y: v1.y + v2.y
  }
}

function subtractVectors(v1, v2) {
  return addVectors(v1, scaleVector(v2, -1))
}

function numberToParticleType(number) {
  var maxParticleType = max(Object.values(PARTICLE))
  var type = int(number % (maxParticleType + 1))
  if (type < 0) {
    type += maxParticleType + 1
  }
  return type
}

function newParticle(x, y, type) {
  maxParticleId = max([-1].concat(simulationState.particles.map((p) => p.id)))
  particle = {
    id: maxParticleId + 1,
    x: x,
    y: y,
    velocity: {
      x: 0,
      y: 0
    },
    type: type,
    radius: 1,
    mass: 1,
    state: {}
  }
  switch (type) {
    case PARTICLE.control:
      particle.state.memory = []
      particle.state.connectionParams = []
      particle.state.signalFunction = "'()"
      particle.state.connectionFunction = "'()"
      particle.state.updateFunction = "'()"
      particle.state.delayFunction = "1"
      particle.state.updateDelay = 0
      particle.state.connectedParticles = []
      break
    case PARTICLE.energy:
      particle.radius = 0.5
      particle.mass = 0.25
      break
    case PARTICLE.binder:
      particle.state.range = 0
      particle.state.heldParticles = []
      particle.state.distances = []
      break
    case PARTICLE.battery:
      particle.state.energy = simulationSettings.batteryDefaultEnergy
      break
  }
  return particle
}

function copyParticle(particle) {
  var newParticle = {
    id: particle.id,
    x: particle.x,
    y: particle.y,
    velocity: {
      x: particle.velocity.x,
      y: particle.velocity.y
    },
    type: particle.type,
    radius: particle.radius,
    mass: particle.mass,
    state: {}
  }
  switch (particle.type) {
    case PARTICLE.control:
      newParticle.state.memory = particle.state.memory.slice()
      newParticle.state.connectionParams = particle.state.connectionParams.slice()
      newParticle.state.signalFunction = particle.state.signalFunction
      newParticle.state.connectionFunction = particle.state.connectionFunction
      newParticle.state.updateFunction = particle.state.updateFunction
      newParticle.state.delayFunction = particle.state.delayFunction
      newParticle.state.updateDelay = particle.state.updateDelay
      newParticle.state.connectedParticles = particle.state.connectedParticles.slice()
      break
    case PARTICLE.binder:
      newParticle.state.range = particle.state.range
      newParticle.state.heldParticles = particle.state.heldParticles.slice()
      newParticle.state.distances = particle.state.distances.map((x) => x.slice())
      break
    case PARTICLE.battery:
      newParticle.state.energy = particle.state.energy
      break
  }
  return newParticle
}

function moveParticle(particle, delta) {
  copyPos(addVectors(particle, scaleVector(particle.velocity, delta)), particle)
}

function squareDist(p1, p2) {
  var dx = p1.x - p2.x
  var dy = p1.y - p2.y
  return dx * dx + dy * dy
}

function screenPos(pos, settings) {
  var scaleFactor = settings.canvasSize / (simulationSettings.worldSize * settings.zoom)
  var xOffset = -(settings.scrollX - 0.5 * settings.zoom) * simulationSettings.worldSize
  var yOffset = -(settings.scrollY - 0.5 * settings.zoom) * simulationSettings.worldSize
  return {
    x: (pos.x + xOffset) * scaleFactor,
    y: (pos.y + yOffset) * scaleFactor
  }
}

function worldPos(pos, settings) {
  var scaleFactor = settings.canvasSize / (simulationSettings.worldSize * settings.zoom)
  var xOffset = -(settings.scrollX - 0.5 * settings.zoom) * simulationSettings.worldSize
  var yOffset = -(settings.scrollY - 0.5 * settings.zoom) * simulationSettings.worldSize
  return {
    x: (pos.x / scaleFactor) - xOffset,
    y: (pos.y / scaleFactor) - yOffset
  }
}

function actionPosition(index, settings) {
  var topRow = index <= ACTION_ROW_SEPARATOR
  if (index <= ACTION_ROW_SEPARATOR) {
    return {
      x: (displaySettings.actionIconBuffer + (displaySettings.actionIconBuffer + displaySettings.actionIconSize) * (index)) * displaySettings.canvasSize,
      y: (1 - 2 * (displaySettings.actionIconBuffer + displaySettings.actionIconSize)) * displaySettings.canvasSize
    }
  } else {
    return {
      x: (displaySettings.actionIconBuffer + (displaySettings.actionIconBuffer + displaySettings.actionIconSize) * (index - ACTION_ROW_SEPARATOR - 1)) * displaySettings.canvasSize,
      y: (1 - (displaySettings.actionIconBuffer + displaySettings.actionIconSize)) * displaySettings.canvasSize
    }
  }
}

function inTextBox() {
  return document.activeElement.type == 'textarea'
}

function togglePause() {
  selectedProgramID = -1
  paused = !paused
}

function prependVariables(code, variables) {
  var prefix = ""
  for (var variable in variables) {
    prefix += "(" + variable.toString() + " " + variables[variable].toString() + ") "
  }
  return "(let (" + prefix + ") " + code + ")"
}

function stringToNumberList(string) {
  var splitString = string.replace(/\s/g, '').split(',')
  var nums = []
  for (var chunk of splitString) {
    if (chunk != "") {
      var num = Number(chunk)
      if (isNaN(num)) {
        return null
      }
      nums.push(num)
    }
  }
  return nums
}

function saveState() {
  var object = {
    settings: simulationSettings,
    state: simulationState,
    randomParticles: []
  }
  var download = document.createElement("a");
  download.href = URL.createObjectURL(new Blob([JSON.stringify(object, null, 2)], {
    type: "text/plain"
  }));
  var d = new Date()
  var name = "broth_"
  name += d.getMonth()
  name += "-"
  name += d.getDate()
  name += "-"
  name += d.getFullYear()
  name += "_"
  name += d.getHours()
  name += "-"
  name += d.getMinutes()
  name += "-"
  name += d.getSeconds()
  name += ".json"
  download.setAttribute("download", name);
  download.click();
}

function loadState(string) {
  var object = JSON.parse(string)
  simulationSettings.settings = object.settings
  simulationState = object.state
  for (var particleObject of object.randomParticles) {
    for (var i = 0; i < particleObject.count; i++) {
      var particle = newParticle(random() * simulationSettings.worldSize, random() * simulationSettings.worldSize, particleObject.type)
      particle.velocity.x = (random() * 2 - 1) * particleObject.velocityFactor
      particle.velocity.y = (random() * 2 - 1) * particleObject.velocityFactor
      simulationState.particles.push(particle)
    }
  }
}

function loadLocalState() {
  var open = document.createElement("input");
  open.type = "file"
  open.onchange = function(event) {
    var file = event.target.files[0]
    var reader = new FileReader()
    reader.readAsText(file)
    reader.onload = function(event2) {
      loadState(event2.target.result)
    }
  }
  open.click();
}

function findParticle(particleList, id) {
  matches = particleList.filter((p) => p.id == id)
  if (matches.length == 1) {
    return matches[0]
  }
  return null
}

function sexpToArray(str) {
  if (str[0] == "'") {
    if (str.length == 3) {
      return []
    }
    return str.slice(2, -1).split(" ").map(s => (Number(s)))
  }
  if (str[0] == "(" && str.slice(-1) == ")") {
    var array = []
    str = str.slice(1, -1)
    var depth = 0
    var currentSubStr = ""
    for (var i = 0; i < str.length; i++) {
      if (str[i] == "(") {
        depth++
      }
      if (str[i] == ")") {
        depth--
      }
      if (depth == 0 && str[i] == " ") {
        array.push(sexpToArray(currentSubStr))
        currentSubStr = ""
      } else {
        currentSubStr += str[i]
      }
    }
    array.push(sexpToArray(currentSubStr))
    return array
  }
  return str
}

function arrayToSexp(array) {
  if (!Array.isArray(array)) {
    return array
  }
  var str = "("
  if (array.length == 0 || !isNaN(array[0])) {
    str = "'("
  }
  for (var i = 0; i < array.length; i++) {
    var element = array[i]
    if (Array.isArray(element)) {
      str += arrayToSexp(element)
    } else {
      str += element.toString()
    }
    if (i != array.length - 1) {
      str += " "
    }
  }
  return str + ")"
}

function mutateSexp(sexp, settings) {
  function getLocations(arr, base) {
    if (!Array.isArray(arr) || !isNaN(arr[0])) {
      return [base]
    } else {
      var locs = [base]
      for (var i = 1; i < arr.length; i++) {
        locs = locs.concat(getLocations(arr[i], base.concat([i])))
      }
      return locs
    }
  }

  function arrayAt(arr, location) {
    for (var i = 0; i < location.length; i++) {
      arr = arr[location[i]]
    }
    return arr
  }

  // Convert sexp into an array for easier manipulation
  var array = sexpToArray(sexp)

  var choice = random()
  if (choice < 1 / 3) {
    // Pick a random location and replace the subtree there with a new, randomly generated subtree
    var locations = getLocations(array, [])
    var chosenLocation = locations[int(random() * locations.length)]

    function randomFloatList() {
      var list = []
      while (random() < settings.mutationSizeLambda) {
        list.push(normalRandom(settings.mutationGaussianFactor))
      }
      return list
    }

    var subChoice = random()
    var subtree = []
    if (subChoice < 1 / 3) {
      // Replace the subtree at the chosen location with a list of random floats
      subtree = 'input'
    }
    if (subChoice < 2 / 3) {
      // Replace the subtree at the chosen location with a list of random floats
      subtree = randomFloatList()
    } else {
      // Replace the subtree at the chosen location with a subtree consisting of a random function with random lists of floats, or inputs, as arguments
      var chosenFunction = settings.operations[int(random() * settings.operations.length)]
      subtree.push(chosenFunction.name)
      for (var i = 0; i < chosenFunction.args; i++) {
        if (random() < 1 / 2) {
          subtree.push(randomFloatList())
        } else {
          subtree.push('input')
        }
      }
    }

    // Place the constructed subtree at the chosen location
    if (chosenLocation.length == 0) {
      array = subtree
    } else {
      parentArray = arrayAt(array, chosenLocation.slice(0, -1))
      parentArray[chosenLocation.slice(-1)[0]] = subtree
    }
  } else if (choice < 2 / 3) {
    // Pick two random locations, and then replace the subtree at one location with the subtree at the other location
    var locations = getLocations(array, [])
    var fromLocation = locations[int(random() * locations.length)]
    var toLocation = locations[int(random() * locations.length)]

    function copySexpArray(arr) {
      if (!Array.isArray(arr)) {
        return arr
      }
      var newArr = []
      for (var i = 0; i < arr.length; i++) {
        newArr.push(copySexpArray(arr[i]))
      }
      return newArr
    }

    var fromArray = copySexpArray(arrayAt(array, fromLocation))

    if (toLocation.length == 0) {
      array = fromArray
    } else {
      var toParentArray = arrayAt(array, toLocation.slice(0, -1))
      toParentArray[toLocation.slice(-1)[0]] = fromArray
    }
  } else {
    // Pick a random list of floats and modify it
    var initialLocations = getLocations(array, [])
    var locations = []
    for (var i = 0; i < initialLocations.length; i++) {
      var loc = initialLocations[i]
      var locationArray = arrayAt(array, loc)
      if (locationArray.length == 0 || !isNaN(locationArray[0])) {
        locations.push(loc)
      }
    }
    if (locations.length > 1 / 3) {
      var chosenLocation = locations[int(random() * locations.length)]
      var subArray = arrayAt(array, chosenLocation)

      var subChoice = random()
      if (subChoice < 0) {
        // Add a random float to the list at a random location
        var index = int(random() * (subArray.length + 1))
        subArray.splice(index, 0, normalRandom(settings.mutationGaussianFactor))
      } else if (subChoice < 2 / 3) {
        // Remove a random float from the list
        if (subArray.length > 0) {
          var index = int(random() * subArray.length)
          subArray.splice(index, 1)
        }
      } else {
        // Change a random float in the list
        if (subArray.length > 0) {
          var index = int(random() * subArray.length)
          subArray[index] += normalRandom(settings.mutationGaussianFactor)
        }
      }
    }
  }

  // Convert the array back into an S-expression
  return arrayToSexp(array)
}

function mutateParticle(particle) {
  switch (int(random() * 4)) {
    case 0:
      particle.state.signalFunction = mutateSexp(particle.state.signalFunction, simulationSettings)
      break
    case 1:
      particle.state.connectionFunction = mutateSexp(particle.state.connectionFunction, simulationSettings)
      break
    case 2:
      particle.state.updateFunction = mutateSexp(particle.state.updateFunction, simulationSettings)
      break
    case 3:
      particle.state.delayFunction = mutateSexp(particle.state.delayFunction, simulationSettings)
      break
  }
}

async function timestep(state, delta, settings) {
  var newState = {
    clearDelay: state.clearDelay
  }
  newState.clearDelay -= delta
  if (newState.clearDelay < 0) {
    newState.clearDelay += settings.clearDelayTime
    clearHalfMap()
  }

  var particles = state.particles.slice()

  // Create a copy of the list of particles
  var newParticles = particles.map((p) => copyParticle(p))

  // Decrement delays for control particles, and run updates when necessary
  for (var particle of newParticles) {
    if (particle.type == PARTICLE.control) {
      particle.state.updateDelay -= delta
      var connectedBatteries = newParticles.filter((p) => p.type == PARTICLE.battery && particle.state.connectedParticles.includes(p.id))
      var availableEnergy = connectedBatteries.map((b) => b.state.energy).reduce((a, b) => a + b, 0)
      if (particle.state.updateDelay <= 0) {
        var input = []
        for (var i = 0; i < particle.state.connectedParticles.length; i++) {
          var connectedParticle = findParticle(newParticles, particle.state.connectedParticles[i])
          if (connectedParticle != null) {
            input.push(connectedParticle.type)
          }
        }
        while (particle.state.updateDelay <= 0) {
          if (availableEnergy < settings.computationCost) {
            break
          }
          for (var battery of connectedBatteries) {
            battery.state.energy *= (availableEnergy - settings.computationCost) / availableEnergy
          }
          availableEnergy = connectedBatteries.map((b) => b.state.energy).reduce((a, b) => a + b, 0)
          var variables = {
            "state": particle.state.memory,
            "input": input
          }
          particle.state.memory = execSexp(particle.state.updateFunction, variables, sexpFunctions)
          variables["state"] = particle.state.memory
          particle.state.updateDelay += max(0, execSexp(particle.state.delayFunction, variables, sexpFunctions))
          var signal = execSexp(particle.state.signalFunction, variables, sexpFunctions)
          for (var i = 0; i < particle.state.connectedParticles.length; i++) {
            var connectedParticle = findParticle(newParticles, particle.state.connectedParticles[i])
            switch (connectedParticle.type) {
              case PARTICLE.binder:
                var range = signal.splice(0, 1)[0]
                if (range != null) {
                  if (range > 0 && range != connectedParticle.state.range) {
                    var energyCost = range * range * settings.binderRangeEnergyFactor
                    if (availableEnergy >= energyCost) {
                      connectedParticle.state.range = range
                      var squareRange = connectedParticle.state.range * connectedParticle.state.range
                      var grabbedParticles = newParticles.filter((b) => squareDist(connectedParticle, b) < squareRange)
                      connectedParticle.state.heldParticles = grabbedParticles.map((b) => b.id)
                      connectedParticle.state.distances = grabbedParticles.map((b) => grabbedParticles.map((b2) => Math.sqrt(squareDist(b, b2))))
                      for (var battery of connectedBatteries) {
                        battery.state.energy *= (availableEnergy - energyCost) / availableEnergy
                      }
                      availableEnergy = connectedBatteries.map((b) => b.state.energy).reduce((a, b) => a + b, 0)
                    }
                  }
                  if (range < 0) {
                    connectedParticle.state.range = 0
                  }
                }
                break
              case PARTICLE.control:
                if (signal.length > 0) {
                  if (availableEnergy >= settings.reprogramCost) {
                    connectedParticle.state.memory = signal.splice(0)
                    connectedParticle.state.connectionParams = []
                    connectedParticle.state.signalFunction = particle.state.signalFunction
                    connectedParticle.state.connectionFunction = particle.state.connectionFunction
                    connectedParticle.state.updateFunction = particle.state.updateFunction
                    connectedParticle.state.delayFunction = particle.state.delayFunction
                    while (random() < simulationSettings.mutationChance) {
                      mutateParticle(connectedParticle)
                    }
                    connectedParticle.state.updateDelay = 0
                    connectedParticle.state.connectedParticles = []
                    availableEnergy -= settings.reprogramCost
                    for (var battery of connectedBatteries) {
                      battery.state.energy *= (availableEnergy - settings.reprogramCost) / availableEnergy
                    }
                    particle.state.connectedParticles.splice(i, 1)
                    i--
                  }
                }
                break
            }
          }
        }
        particle.state.connectionParams = execSexp(particle.state.connectionFunction, {
          "state": particle.state.memory,
          "input": input
        }, sexpFunctions)
      }
    }
  }

  // Update particle position based on velocity
  for (var particle of newParticles) {
    moveParticle(particle, delta)
  }

  // Check for collisions off of walls and bounce particles
  for (var i = 0; i < particles.length; i++) {
    var particle = particles[i]
    var newParticle = newParticles[i]
    if (newParticle.x < newParticle.radius) {
      newParticle.x = newParticle.radius + (newParticle.radius - newParticle.x)
      newParticle.velocity.x *= -1
    }
    if (newParticle.x > settings.worldSize - newParticle.radius) {
      newParticle.x = (settings.worldSize - newParticle.radius) - (newParticle.x - (settings.worldSize - newParticle.radius))
      newParticle.velocity.x *= -1
    }
    if (newParticle.y < newParticle.radius) {
      newParticle.y = newParticle.radius + (newParticle.radius - newParticle.y)
      newParticle.velocity.y *= -1
    }
    if (newParticle.y > settings.worldSize - newParticle.radius) {
      newParticle.y = (settings.worldSize - newParticle.radius) - (newParticle.y - (settings.worldSize - newParticle.radius))
      newParticle.velocity.y *= -1
    }
  }

  // Check for collisions between energy particles and other particles, and destroy the energy particles and give energy to the nearest battery
  for (var i = 0; i < newParticles.length; i++) {
    var particle = newParticles[i]
    if (particle.type == PARTICLE.energy) {
      var collidingParticles = newParticles.filter((p) => p.id != particle.id && squareDist(particle, p) < (particle.radius + p.radius) ** 2)
      if (collidingParticles.length > 0) {
        newParticles.splice(i, 1)
        particles.splice(i, 1)
        i--
        var batteries = newParticles.filter((p) => p.type == PARTICLE.battery)
        if (batteries.length > 0) {
          var closestBattery = batteries.map((b) => [b, squareDist(particle, b)]).sort((a, b) => a[1] - b[1])[0][0]
          closestBattery.state.energy += settings.energyParticleEnergy
        }
      }
    }
  }

  // Check for collisions between particles, and make them bounce
  for (var i = 0; i < newParticles.length; i++) {
    var oldParticle = particles[i]
    var particle = newParticles[i]
    for (var i2 = 0; i2 < i; i2++) {
      var oldParticle2 = particles[i2]
      var particle2 = newParticles[i2]
      var radiusSum = (particle.radius + particle2.radius)
      var squareD = squareDist(particle, particle2)
      if (squareD < radiusSum * radiusSum) {
        var dist = Math.sqrt(squareD)
        var oldDist = Math.sqrt(squareDist(oldParticle, oldParticle2))
        var moveProp = (radiusSum - oldDist) / (dist - oldDist)
        var offset = subtractVectors(particle2, particle)
        if (moveProp >= 0 && moveProp < 1) {
          copyPos(tweenVectors(oldParticle, particle, moveProp), particle)
          copyPos(tweenVectors(oldParticle2, particle2, moveProp), particle2)
        } else {
          var overlap = scaleVector(offset, (dist - radiusSum) / dist)
          var totalMass = particle.mass + particle2.mass
          copyPos(addVectors(particle, scaleVector(overlap, particle2.mass / totalMass)), particle)
          copyPos(addVectors(particle2, scaleVector(overlap, -particle.mass / totalMass)), particle2)
        }
        var contactAngle = Math.atan2(offset.y, offset.x)
        var particleSpeed = Math.sqrt(particle.velocity.x * particle.velocity.x + particle.velocity.y * particle.velocity.y)
        var particle2Speed = Math.sqrt(particle2.velocity.x * particle2.velocity.x + particle2.velocity.y * particle2.velocity.y)
        var particleAngle = Math.atan2(particle.velocity.y, particle.velocity.x)
        var particle2Angle = Math.atan2(particle2.velocity.y, particle2.velocity.x)

        particle.velocity.x = ((particleSpeed * Math.cos(particleAngle - contactAngle) * (particle.mass - particle2.mass) + 2 * particle2.mass * particle2Speed * Math.cos(particle2Angle - contactAngle)) / (particle.mass + particle2.mass)) * Math.cos(contactAngle) + particleSpeed * Math.sin(particleAngle - contactAngle) * Math.cos(contactAngle + Math.PI / 2)
        particle.velocity.y = ((particleSpeed * Math.cos(particleAngle - contactAngle) * (particle.mass - particle2.mass) + 2 * particle2.mass * particle2Speed * Math.cos(particle2Angle - contactAngle)) / (particle.mass + particle2.mass)) * Math.sin(contactAngle) + particleSpeed * Math.sin(particleAngle - contactAngle) * Math.sin(contactAngle + Math.PI / 2)

        particle2.velocity.x = ((particle2Speed * Math.cos(particle2Angle - contactAngle) * (particle2.mass - particle.mass) + 2 * particle.mass * particleSpeed * Math.cos(particleAngle - contactAngle)) / (particle2.mass + particle.mass)) * Math.cos(contactAngle) + particle2Speed * Math.sin(particle2Angle - contactAngle) * Math.cos(contactAngle + Math.PI / 2)
        particle2.velocity.y = ((particle2Speed * Math.cos(particle2Angle - contactAngle) * (particle2.mass - particle.mass) + 2 * particle.mass * particleSpeed * Math.cos(particleAngle - contactAngle)) / (particle2.mass + particle.mass)) * Math.sin(contactAngle) + particle2Speed * Math.sin(particle2Angle - contactAngle) * Math.sin(contactAngle + Math.PI / 2)

        if (moveProp >= 0 && moveProp < 1) {
          moveParticle(particle, delta * (1 - moveProp))
          moveParticle(particle2, delta * (1 - moveProp))
        }
      }
    }
  }

  // Apply drag to particles
  for (var particle of newParticles) {
    copyPos(scaleVector(particle.velocity, (1 - settings.drag) ** delta), particle.velocity)
  }

  // Make binder particles grab nearby particles if they've just been activated, or influence the velocity of particles they've already grabbed
  for (var particle of newParticles.filter((particle) => particle.type == PARTICLE.binder)) {
    for (var i = 0; i < particle.state.heldParticles.length; i++) {
      // For each held particle, check if it is outside the range of the binder, and if so, release it
      var heldParticle = findParticle(newParticles, particle.state.heldParticles[i])
      if (heldParticle == null || squareDist(particle, heldParticle) > particle.state.range * particle.state.range) {
        particle.state.heldParticles.splice(i, 1)
        particle.state.distances.splice(i, 1)
        for (var i2 = 0; i2 < particle.state.heldParticles.length; i2++) {
          particle.state.distances[i2].splice(i, 1)
        }
        i--
      }
    }
    for (var i = 0; i < particle.state.heldParticles.length; i++) {
      var heldParticle = findParticle(newParticles, particle.state.heldParticles[i])
      for (var i2 = 0; i2 < particle.state.heldParticles.length; i2++) {
        if (i != i2) {
          var heldParticle2 = findParticle(newParticles, particle.state.heldParticles[i2])
          var properDistance = particle.state.distances[i][i2]
          var realDistance = Math.sqrt(squareDist(heldParticle, heldParticle2))
          var difference = (realDistance - properDistance)
          var offset = {
            x: heldParticle2.x - heldParticle.x,
            y: heldParticle2.y - heldParticle.y
          }
          copyPos(addVectors(heldParticle.velocity, scaleVector(offset, delta * settings.binderPower * difference / (realDistance * heldParticle.mass))), heldParticle.velocity)
          copyPos(addVectors(heldParticle2.velocity, scaleVector(offset, -delta * settings.binderPower * difference / (realDistance * heldParticle2.mass))), heldParticle2.velocity)
        }
      }
    }
  }

  // Disconnect particles connected to control particles that have moved out of range
  for (var particle of newParticles.filter((particle) => particle.type == PARTICLE.control)) {
    for (var i = 0; i < particle.state.connectedParticles.length; i++) {
      var connectedParticle = findParticle(newParticles, particle.state.connectedParticles[i])
      if (connectedParticle == null || squareDist(particle, connectedParticle) > settings.controlRange * settings.controlRange) {
        particle.state.connectedParticles.splice(i, 1)
        i--
      }
    }
  }

  // Check if any control particles have the right type of particle in the right place to connect to based on their connection parameters
  for (var particle of newParticles.filter((p) => p.type == PARTICLE.control)) {
    var params = particle.state.connectionParams.slice()
    if (params.length >= 4) {
      var connectionType = numberToParticleType(params[0])
      var connectedAllowed = params[1] < 0 || params[1] >= 1
      var nonconnectedAllowed = params[1] < 1
      var relevantParticles = []
      var particleDistances = []
      var particleRanges = []
      if (params[3] > 0) {
        relevantParticles.push(particle)
        particleDistances.push(params[2])
        particleRanges.push(params[3])
      }
      for (var i = 0; i < particle.state.connectedParticles.length; i++) {
        var distanceIndex = 4 + i * 2
        var rangeIndex = distanceIndex + 1
        if (params.length <= rangeIndex) {
          break
        }
        var range = params[rangeIndex]
        if (range > 0) {
          var distance = params[distanceIndex]
          var connectedParticle = findParticle(newParticles, particle.state.connectedParticles[i])
          relevantParticles.push(connectedParticle)
          particleDistances.push(distance)
          particleRanges.push(range)
        }
      }
      if (relevantParticles.length > 0) {
        for (var particle2 of newParticles.filter((p) => p.type == connectionType)) {
          if (particle.id != particle2.id && !particle.state.connectedParticles.includes(particle2.id) && squareDist(particle, particle2) < settings.controlRange * settings.controlRange) {
            var distancesValid = true
            for (var i = 0; i < relevantParticles.length; i++) {
              var particle3 = relevantParticles[i]
              var distance = particleDistances[i]
              var range = particleRanges[i]
              if (abs(sqrt(squareDist(particle2, particle3)) - distance) > range) {
                distancesValid = false
              }
            }
            if (distancesValid) {
              var allowed = true
              if (!connectedAllowed || !nonconnectedAllowed) {
                var connected = particles.filter((p) => p.type == PARTICLE.control && p.state.connectedParticles.includes(particle2.id)).length > 0
                allowed = (connected && connectedAllowed) || (!connected && nonconnectedAllowed)
              }
              if (allowed) {
                particle.state.connectedParticles.push(particle2.id)
                particle.state.updateDelay = 0
              }
            }
          }
        }
      }
    }
  }

  newState.particles = newParticles
  return newState
}

function clearHalfMap() {
  var angle = (2 * random() - 1) * Math.PI
  for (var i = 0; i < simulationState.particles.length; i++) {
    var p = simulationState.particles[i]
    var particleAngle = Math.atan2(p.y - simulationSettings.worldSize / 2, p.x - simulationSettings.worldSize / 2)
    var diff = angle - particleAngle
    diff += Math.PI
    while (diff < 0) {
      diff += Math.PI * 2
    }
    diff %= Math.PI * 2
    diff -= Math.PI
    if (diff > 0) {
      simulationState.particles[i] = newParticle(p.x, p.y, p.type)
      copyPos(p.velocity, simulationState.particles[i].velocity)
    }
  }
}

function execSexp(sexp, variables, functions) {
  if (variables[sexp] != null) {
    return variables[sexp]
  }

  if (sexp[0] == "'") {
    var listString = sexp.slice(2, -1)
    var valueStrings = listString.split(" ")
    if (valueStrings.length == 1 && valueStrings[0] == "") {
      return []
    }
    return valueStrings.map(s => Number(s))
  }

  var subSexps = []
  var currentSubSexp = ""
  var depth = 0
  for (var i = 1; i < sexp.length - 1; i++) {
    if (sexp[i] == "(") {
      depth++
    }
    if (sexp[i] == ")") {
      depth--
    }
    if (depth == 0 && sexp[i] == " ") {
      subSexps.push(currentSubSexp)
      currentSubSexp = ""
    } else {
      currentSubSexp += sexp[i]
    }
  }
  subSexps.push(currentSubSexp)

  return functions[subSexps[0]](subSexps.slice(1).map(s => execSexp(s, variables, functions)))
}

async function setup() {
  color(50, 80, 80)

  // Define settings
  simulationSettings = Object.assign({}, DEFAULT_SIMULATION_SETTINGS)
  displaySettings = Object.assign({}, DEFAULT_DISPLAY_SETTINGS)

  // Basic p5.js setup
  createCanvas(displaySettings.canvasSize, displaySettings.canvasSize)
  frameRate(displaySettings.framerate)

  // Create text inputs
  createElement('br')
  var saveButton = createButton('Save State')
  saveButton.mousePressed(saveState)
  createElement('br')
  var loadButton = createButton('Load State')
  loadButton.mousePressed(loadLocalState)
  createElement('h5', 'Update Function')
  updateFunctionInput = createElement('textarea')
  createElement('h5', 'Connection Function')
  connectionFunctionInput = createElement('textarea')
  createElement('h5', 'Signal Function')
  signalFunctionInput = createElement('textarea')
  createElement('h5', 'Delay Function')
  delayFunctionInput = createElement('textarea')
  createElement('h5', 'Internal State')
  internalStateInput = createElement('textarea')
  createElement('h5', 'Current Delay')
  delayInput = createElement('textarea')

  // Define colors
  COLORS.background = color(0, 0, 0)

  COLORS.ui = color(255, 255, 255)

  COLORS.inspect = color(255, 100, 100)

  COLORS.controlFill = color(0, 50, 50)
  COLORS.controlStroke = color(0, 100, 100)

  COLORS.energyFill = color(220, 200, 170)
  COLORS.energyStroke = color(255, 255, 210)

  COLORS.binderFill = color(100, 100, 0)
  COLORS.binderStroke = color(200, 200, 0)

  COLORS.batteryFill = color(80, 140, 80)
  COLORS.batteryStroke = color(120, 220, 120)

  COLORS.moverFill = color(140, 80, 80)
  COLORS.moverStroke = color(220, 120, 120)

  // Define basic operations for use in control particle code
  sexpFunctions["t_before"] = function(x) {
    var list = x[0]
    var indexList = x[1]
    if (indexList.length == 0) {
      return []
    }
    return list.slice(0, int(indexList[0]))
  }
  sexpFunctions["t_+"] = function(x) {
    var a1 = x[0]
    var a2 = x[0]
    var length = min(a1.length, a2.length)
    var list = []
    for (var i = 0; i < length; i++) {
      list.push(a1[i] + a2[i])
    }
    return list
  }
  sexpFunctions["t_-"] = function(x) {
    var a1 = x[0]
    var a2 = x[0]
    var length = min(a1.length, a2.length)
    var list = []
    for (var i = 0; i < length; i++) {
      list.push(a1[i] - a2[i])
    }
    return list
  }
  sexpFunctions["t_*"] = function(x) {
    var a1 = x[0]
    var a2 = x[0]
    var length = min(a1.length, a2.length)
    var list = []
    for (var i = 0; i < length; i++) {
      list.push(a1[i] * a2[i])
    }
    return list
  }
  sexpFunctions["t_/"] = function(x) {
    var a1 = x[0]
    var a2 = x[0]
    var length = min(a1.length, a2.length)
    var list = []
    for (var i = 0; i < length; i++) {
      if (a2[i] == 0) {
        list.push(0)
      } else {
        list.push(a1[i] / a2[i])
      }
    }
    return list
  }
  sexpFunctions["t_exp"] = function(x) {
    var a1 = x[0]
    var a2 = x[0]
    var length = min(a1.length, a2.length)
    var list = []
    for (var i = 0; i < length; i++) {
      if (a1[i] <= 0) {
        list.push(0)
      } else {
        list.push(a1[i] ** a2[i])
      }
    }
    return list
  }
  sexpFunctions["t_sum"] = function(x) {
    return [x[0].reduce((s, a) => s + a, 1)]
  }
  sexpFunctions["t_abs"] = function(x) {
    return x[0].map(a => abs(a))
  }
  sexpFunctions["t_product"] = function(x) {
    return [x[0].reduce((s, a) => s * a, 1)]
  }
  sexpFunctions["t_reverse"] = function(x) {
    return x[0].slice().reverse()
  }
  sexpFunctions["t_size"] = function(x) {
    return [x[0].length]
  }
  sexpFunctions["t_floor"] = function(x) {
    return x[0].map(floor)
  }
  sexpFunctions["t_not"] = function(x) {
    return x[0].map(n => n > 0 ? 0 : 1)
  }
  sexpFunctions["t_and"] = function(x) {
    var a1 = x[0]
    var a2 = x[1]
    var length = min(a1.length, a2.length)
    var list = []
    for (var i = 0; i < length; i++) {
      list.push(a1[i] > 0 && a2[i] > 0 ? 1 : 0)
    }
    return list
  }
  sexpFunctions["t_or"] = function(x) {
    var a1 = x[0]
    var a2 = x[1]
    var length = min(a1.length, a2.length)
    var list = []
    for (var i = 0; i < length; i++) {
      list.push(a1[i] > 0 || a2[i] > 0 ? 1 : 0)
    }
    return list
  }
  sexpFunctions["t_xor"] = function(x) {
    function xor(a, b) {
      return (a || b) && !(a && b)
    }
    var a1 = x[0]
    var a2 = x[1]
    var length = min(a1.length, a2.length)
    var list = []
    for (var i = 0; i < length; i++) {
      list.push(xor(a1[i] > 0, a2[i] > 0) ? 1 : 0)
    }
    return list
  }
  sexpFunctions["t_concat"] = function(x) {
    return x[0].concat(x[1])
  }
  sexpFunctions["t_if"] = function(x) {
    return x[0][0] > 0 ? x[1] : x[2]
  }
  sexpFunctions["t_="] = function(x) {
    var a1 = x[0]
    var a2 = x[1]
    var length = min(a1.length, a2.length)
    var list = []
    for (var i = 0; i < length; i++) {
      list.push(a1[i] == a2[i] ? 1 : 0)
    }
    return list
  }
  sexpFunctions["t_>"] = function(x) {
    var a1 = x[0]
    var a2 = x[1]
    var length = min(a1.length, a2.length)
    var list = []
    for (var i = 0; i < length; i++) {
      list.push(a1[i] > a2[i] ? 1 : 0)
    }
    return list
  }
  sexpFunctions["t_<"] = function(x) {
    var a1 = x[0]
    var a2 = x[1]
    var length = min(a1.length, a2.length)
    var list = []
    for (var i = 0; i < length; i++) {
      list.push(a1[i] < a2[i] ? 1 : 0)
    }
    return list
  }

  // Initialize  default state
  simulationState = {
    clearDelay: simulationSettings.clearDelayTime,
    particles: []
  }
  var replicatorBinder = newParticle(300, 300, PARTICLE.binder)
  simulationState.particles.push(replicatorBinder)
  replicatorBinder.state.heldParticles = [0, 1, 2]
  replicatorBinder.state.distances = [
    [0, 4, 4],
    [4, 0, 4 * Math.sqrt(2)],
    [4, 4 * Math.sqrt(2), 4]
  ]
  replicatorBinder.state.range = 7
  var replicatorControl = newParticle(304, 300, PARTICLE.control)
  simulationState.particles.push(replicatorControl)
  replicatorControl.state.memory = [1]
  replicatorControl.state.connectionParams = [2, 0.5, 10, 2, 13, 3, 10, 2]
  replicatorControl.state.updateDelay = 1
  replicatorControl.state.connectedParticles = [0, 2]
  replicatorControl.state.signalFunction = "(t_if (t_= state '(-3)) '(7) (t_if (t_= state '(-2)) '(13) (t_if (t_= state '(-1)) '(-1) (t_if (t_= state '(1)) '(7 13) (t_if (t_= state '(2)) '(7 0 0) '())))))"
  replicatorControl.state.connectionFunction = "(t_if (t_= state '(-3)) '() (t_if (t_= state '(-2)) '(3 0.5 5 1 5 1) (t_if (t_= state '(0)) (t_if (t_= (t_size input) '(1)) '(3 1 15 5 10 2) '(2 -1 5 1)) (t_if (t_= (t_size input) '(2)) '(2 0.5 10 2 13 3 10 2) (t_if (t_= state '(3)) '() '(0 0.5 0 0 0 0 15 5 5 0.5))))))"
  replicatorControl.state.updateFunction = "(t_if (t_and (t_= (t_abs state) '(3)) (t_= (t_size input) '(2))) '(1) (t_if (t_= state '(-2)) (t_if (t_= (t_size input) '(3)) '(-3) '(-2)) (t_if (t_= state '(-1)) '(-2) (t_if (t_= state '(0)) (t_if (t_= (t_size input) '(2)) '(-1) '(0)) (t_if (t_= state '(2)) '(3) (t_if (t_= state '(1)) (t_if (t_= (t_size input) '(4)) '(2) '(1)) state))))))"
  replicatorControl.state.delayFunction = "(t_if (t_or (t_= state '(-1)) (t_= state '(2))) '(0) '(1))"
  var replicatorBattery = newParticle(300, 296, PARTICLE.battery)
  simulationState.particles.push(replicatorBattery)
  for (var particleType of [PARTICLE.control, PARTICLE.binder, PARTICLE.battery]) {
    for (var i = 0; i < 240; i++) {
      var particle = newParticle(random() * simulationSettings.worldSize, random() * simulationSettings.worldSize, particleType)
      particle.velocity.x = (random() * 2 - 1) * 6
      particle.velocity.y = (random() * 2 - 1) * 6
      simulationState.particles.push(particle)
    }
  }

  // Load a default state from JSON. Uncomment this code for local development in which you'd like to automatically load a state from a JSON file
  /*var client = new XMLHttpRequest()
  client.open('GET', '/states/empty.json')
  client.onload = function() {
    loadState(client.responseText)
  }
  client.send()*/
}

async function draw() {
  paused |= selectedProgramID != -1

  // Logic
  for (var i = 0; i < displaySettings.timestepsPerFrameBase ** displaySettings.timestepsPerFrameExponent; i++) {
    simulationState = await timestep(simulationState, paused ? 0 : simulationSettings.timeDelta, simulationSettings)
  }

  // Input
  if (!inTextBox()) {
    if (keyIsDown(UP_ARROW) || keyIsDown('W'.charCodeAt(0))) {
      displaySettings.scrollY -= displaySettings.zoom * displaySettings.scrollFactor / displaySettings.framerate
    }
    if (keyIsDown(DOWN_ARROW) || keyIsDown('S'.charCodeAt(0))) {
      displaySettings.scrollY += displaySettings.zoom * displaySettings.scrollFactor / displaySettings.framerate
    }
    if (keyIsDown(LEFT_ARROW) || keyIsDown('A'.charCodeAt(0))) {
      displaySettings.scrollX -= displaySettings.zoom * displaySettings.scrollFactor / displaySettings.framerate
    }
    if (keyIsDown(RIGHT_ARROW) || keyIsDown('D'.charCodeAt(0))) {
      displaySettings.scrollX += displaySettings.zoom * displaySettings.scrollFactor / displaySettings.framerate
    }
  }

  background(COLORS.background)

  // Ensure that scroll and zoom are such that they user cannot see outside of the world
  displaySettings.scrollX = min(1 - displaySettings.zoom / 2, max(displaySettings.zoom / 2, displaySettings.scrollX))
  displaySettings.scrollY = min(1 - displaySettings.zoom / 2, max(displaySettings.zoom / 2, displaySettings.scrollY))

  // Draw each particle
  for (var particle of simulationState.particles) {
    var worldP = screenPos(particle, displaySettings)
    var radius = particle.radius * displaySettings.canvasSize / displaySettings.zoom
    switch (particle.type) {
      case PARTICLE.control:
        fill(COLORS.controlFill)
        stroke(COLORS.controlStroke)
        break
      case PARTICLE.energy:
        fill(COLORS.energyFill)
        stroke(COLORS.energyStroke)
        break
      case PARTICLE.binder:
        fill(COLORS.binderFill)
        stroke(COLORS.binderStroke)
        break
      case PARTICLE.battery:
        fill(COLORS.batteryFill)
        stroke(COLORS.batteryStroke)
        break
      case PARTICLE.mover:
        fill(COLORS.moverFill)
        stroke(COLORS.moverStroke)
        break
    }

    strokeWeight(radius * 0.15 / simulationSettings.worldSize)
    circle(worldP.x, worldP.y, radius * 2 / simulationSettings.worldSize)
  }

  // Draw UI elements for particles, e.g. circles that display range and lines that display connections between particles
  var scaleFactor = displaySettings.canvasSize / (simulationSettings.worldSize * displaySettings.zoom)
  for (var particle of simulationState.particles) {
    var pos = screenPos(particle, displaySettings)
    switch (particle.type) {
      case PARTICLE.binder:
        noFill()
        var dimmedStroke = color(COLORS.binderStroke.levels)
        dimmedStroke.setAlpha(75)
        stroke(dimmedStroke)
        strokeWeight(scaleFactor * 0.2)
        circle(pos.x, pos.y, particle.state.range * 2 * scaleFactor)
        if (particle.state.heldParticles != null) {
          for (var id of particle.state.heldParticles) {
            var otherParticle = findParticle(simulationState.particles, id)
            var otherPos = screenPos(otherParticle, displaySettings)
            line(pos.x, pos.y, otherPos.x, otherPos.y)
          }
        }
        break
      case PARTICLE.control:
        if (particle.state.connectedParticles.length > 0) {
          noFill()
          var dimmedStroke = color(COLORS.controlStroke.levels)
          dimmedStroke.setAlpha(150)
          stroke(dimmedStroke)
          strokeWeight(scaleFactor * 0.2)
          circle(pos.x, pos.y, simulationSettings.controlRange * 2 * scaleFactor)
          for (var id of particle.state.connectedParticles) {
            var otherParticle = findParticle(simulationState.particles, id)
            var otherPos = screenPos(otherParticle, displaySettings)
            line(pos.x, pos.y, otherPos.x, otherPos.y)
          }
        }
    }
  }

  // Draw minimap
  noFill()
  strokeWeight(displaySettings.canvasSize * 0.005)
  var dimmedStroke = color(COLORS.ui.levels)
  dimmedStroke.setAlpha(75)
  stroke(dimmedStroke)
  var mapWidth = displaySettings.canvasSize * displaySettings.minimapSize
  var mapOrigin = {
    x: displaySettings.canvasSize * ((1 - (displaySettings.minimapBuffer + displaySettings.minimapSize))),
    y: displaySettings.canvasSize * (displaySettings.minimapBuffer)
  }
  var zoomedWidth = mapWidth * displaySettings.zoom
  rect(mapOrigin.x, mapOrigin.y, mapWidth, mapWidth)
  rect(mapOrigin.x + displaySettings.scrollX * mapWidth - zoomedWidth / 2, mapOrigin.y + displaySettings.scrollY * mapWidth - zoomedWidth / 2, zoomedWidth, zoomedWidth)

  // Draw fling line
  if (selectedActionIndex == ACTION.fling) {
    if (selectedFlingID != -1) {
      var particle = findParticle(simulationState.particles, selectedFlingID)
      if (particle != null) {
        var start = screenPos(particle, displaySettings)
        stroke(COLORS.ui)
        strokeWeight(displaySettings.canvasSize * 0.005)
        line(start.x, start.y, mouseX, mouseY)
        var angle = Math.atan2(start.y - mouseY, start.x - mouseX)
        line(mouseX, mouseY, mouseX + Math.cos(angle + Math.PI / 4) * displaySettings.canvasSize * 0.03, mouseY + Math.sin(angle + Math.PI / 4) * displaySettings.canvasSize * 0.03)
        line(mouseX, mouseY, mouseX + Math.cos(angle - Math.PI / 4) * displaySettings.canvasSize * 0.03, mouseY + Math.sin(angle - Math.PI / 4) * displaySettings.canvasSize * 0.03)
      }
    }
  }

  // Draw program circle
  if (selectedActionIndex == ACTION.program) {
    if (selectedProgramID != -1) {
      var particle = findParticle(simulationState.particles, selectedProgramID)
      if (particle != null) {
        var pos = screenPos(particle, displaySettings)
        stroke(COLORS.controlStroke)
        strokeWeight(0.5 * displaySettings.canvasSize / (displaySettings.zoom * simulationSettings.worldSize))
        circle(pos.x, pos.y, 10 * displaySettings.canvasSize / (displaySettings.zoom * simulationSettings.worldSize))
      }
    }
  }

  // Draw inspect info circle
  if (selectedInspectID != -1) {
    var particle = findParticle(simulationState.particles, selectedInspectID)
    if (particle == null) {
      selectedInspectID = -1
    } else {
      var pos = screenPos(particle, displaySettings)
      stroke(COLORS.inspect)
      strokeWeight(0.5 * displaySettings.canvasSize / (displaySettings.zoom * simulationSettings.worldSize))
      circle(pos.x, pos.y, 5 * displaySettings.canvasSize / (displaySettings.zoom * simulationSettings.worldSize))
      switch (particle.type) {
        case PARTICLE.control:
          var params = particle.state.connectionParams.slice(2)
          var relevantParticles = [particle].concat(particle.state.connectedParticles.map((id) => findParticle(simulationState.particles, id)))
          var restrictions = []
          for (var i = 0; true; i++) {
            var baseIndex = i * 2
            var rangeIndex = baseIndex + 1
            if (rangeIndex >= params.length || i >= relevantParticles.length) {
              break
            }
            var base = params[baseIndex]
            var range = params[rangeIndex]
            var relevantParticle = relevantParticles[i]
            if (range > 0) {
              restrictions.push({
                x: relevantParticle.x,
                y: relevantParticle.y,
                base: base,
                range: range
              })
            }
          }
          if (restrictions.length > 0) {
            for (var i = 0; i < 1000; i++) {
              var chosenRestriction = restrictions[int(random() * restrictions.length)]
              var angle = random() * 2 * Math.PI
              var radius = chosenRestriction.base + chosenRestriction.range * ((2 * random()) - 1)
              var pos = {
                x: chosenRestriction.x + radius * Math.cos(angle),
                y: chosenRestriction.y + radius * Math.sin(angle)
              }
              var valid = true
              var distances = []
              for (r of restrictions) {
                var dist = sqrt(squareDist(r, pos))
                distances.push(dist)
                if (abs(dist - r.base) >= r.range) {
                  valid = false
                  break
                }
              }
              if (valid) {
                var screenP = screenPos(pos, displaySettings)
                noStroke()
                fill(COLORS.inspect)
                circle(screenP.x, screenP.y, 0.3 * displaySettings.canvasSize / (displaySettings.zoom * simulationSettings.worldSize))
              }
            }
          }
          break
      }
    }
  }

  // Draw actions
  for (var a in ACTION) {
    var index = ACTION[a]
    noFill()
    if (index == selectedActionIndex) {
      strokeWeight(displaySettings.canvasSize * 0.005)
      var dimmedStroke = color(COLORS.ui.levels)
      dimmedStroke.setAlpha(150)
      stroke(dimmedStroke)
      strokeWeight(displaySettings.canvasSize * 0.0075)
    } else {
      strokeWeight(displaySettings.canvasSize * 0.005)
      var dimmedStroke = color(COLORS.ui.levels)
      dimmedStroke.setAlpha(75)
      stroke(dimmedStroke)
      strokeWeight(displaySettings.canvasSize * 0.005)
    }
    var actionPos = actionPosition(index)
    var x = actionPos.x
    var y = actionPos.y
    var size = displaySettings.canvasSize * displaySettings.actionIconSize
    rect(x, y, size, size)

    switch (index) {
      case ACTION.createControl:
        fill(COLORS.controlFill)
        stroke(COLORS.controlStroke)
        strokeWeight(size * 0.0375)
        circle(x + size / 2, y + size / 2, size / 2)
        break
      case ACTION.createGrabber:
        fill(COLORS.binderFill)
        stroke(COLORS.binderStroke)
        strokeWeight(size * 0.0375)
        circle(x + size / 2, y + size / 2, size / 2)
        break
      case ACTION.createEnergy:
        fill(COLORS.energyFill)
        stroke(COLORS.energyStroke)
        strokeWeight(size * 0.0375)
        circle(x + size / 2, y + size / 2, size / 2)
        break
      case ACTION.createBattery:
        fill(COLORS.batteryFill)
        stroke(COLORS.batteryStroke)
        strokeWeight(size * 0.0375)
        circle(x + size / 2, y + size / 2, size / 2)
        break
      case ACTION.createMover:
        fill(COLORS.moverFill)
        stroke(COLORS.moverStroke)
        strokeWeight(size * 0.0375)
        circle(x + size / 2, y + size / 2, size / 2)
        break
      case ACTION.fling:
        stroke(COLORS.ui)
        strokeWeight(size * 0.05)
        line(x + size / 2, y + size / 4, x + size / 2, y + size * 3 / 4)
        line(x + size / 2, y + size / 4, x + size * 3 / 8, y + size * 3 / 8)
        line(x + size / 2, y + size / 4, x + size * 5 / 8, y + size * 3 / 8)
        break
      case ACTION.destroyParticle:
        stroke(COLORS.ui)
        strokeWeight(size * 0.05)
        line(x + size / 4, y + size / 4, x + size * 3 / 4, y + size * 3 / 4)
        line(x + size * 3 / 4, y + size / 4, x + size / 4, y + size * 3 / 4)
        break
      case ACTION.program:
        stroke(COLORS.ui)
        strokeWeight(size * 0.05)
        line(x + size / 8, y + size / 2, x + size * 5 / 16, y + size * 5 / 16)
        line(x + size / 8, y + size / 2, x + size * 5 / 16, y + size * 11 / 16)
        line(x + size * 7 / 8, y + size / 2, x + size * 11 / 16, y + size * 5 / 16)
        line(x + size * 7 / 8, y + size / 2, x + size * 11 / 16, y + size * 11 / 16)
        line(x + size * 7 / 16, y + size * 12 / 16, x + size * 9 / 16, y + size * 4 / 16)
        break
      case ACTION.inspect:
        stroke(COLORS.ui)
        strokeWeight(size * 0.1)
        line(x + size / 2, y + size / 2, x + size / 2, y + size * 4 / 5)
        fill(COLORS.ui)
        noStroke()
        circle(x + size / 2, y + size * 3 / 10, size * 0.15)
        break
    }
  }

  // Draw speed icons
  var dimmedStroke = color(COLORS.ui.levels)
  dimmedStroke.setAlpha(75)
  stroke(dimmedStroke)
  strokeWeight(displaySettings.canvasSize * 0.005)
  noFill()
  var size = displaySettings.canvasSize * displaySettings.speedIconSize
  var y = displaySettings.canvasSize * (1 - (displaySettings.speedIconSize + displaySettings.speedIconBuffer))
  var upX = displaySettings.canvasSize * (1 - (displaySettings.speedIconSize + displaySettings.speedIconBuffer))
  var downX = displaySettings.canvasSize * (1 - (displaySettings.speedIconSize * 2 + displaySettings.speedIconBuffer * 3))
  rect(upX, y, size, size)
  rect(downX, y, size, size)
  noStroke()
  fill(dimmedStroke)
  beginShape()
  vertex(downX + size * 0.15, y + size * 0.5)
  vertex(downX + size * 0.45, y + size * 0.2)
  vertex(downX + size * 0.45, y + size * 0.8)
  endShape()
  beginShape()
  vertex(downX + size * 0.45, y + size * 0.5)
  vertex(downX + size * 0.75, y + size * 0.2)
  vertex(downX + size * 0.75, y + size * 0.8)
  endShape()
  beginShape()
  vertex(upX + size * 0.85, y + size * 0.5)
  vertex(upX + size * 0.55, y + size * 0.2)
  vertex(upX + size * 0.55, y + size * 0.8)
  endShape()
  beginShape()
  vertex(upX + size * 0.55, y + size * 0.5)
  vertex(upX + size * 0.25, y + size * 0.2)
  vertex(upX + size * 0.25, y + size * 0.8)
  endShape()

  noStroke()
  fill(dimmedStroke)
  textSize(displaySettings.canvasSize * 0.04)
  textAlign(RIGHT, CENTER)
  text(displaySettings.timestepsPerFrameBase ** displaySettings.timestepsPerFrameExponent, downX - size / 4, y + size / 2)

  // Draw pause icon
  var dimmedStroke = color(COLORS.ui.levels)
  dimmedStroke.setAlpha(75)
  stroke(dimmedStroke)
  strokeWeight(displaySettings.canvasSize * 0.005)
  noFill()
  var size = displaySettings.canvasSize * displaySettings.pauseIconSize
  var x = displaySettings.canvasSize * (1 - (displaySettings.pauseIconSize + displaySettings.pauseIconBuffer))
  var y = displaySettings.canvasSize * (1 - (displaySettings.pauseIconSize + displaySettings.pauseIconBuffer + displaySettings.speedIconSize + displaySettings.speedIconBuffer * 2))
  rect(x, y, size, size)
  if (paused) {
    noStroke()
    var dimmedFill = color(COLORS.ui.levels)
    dimmedFill.setAlpha(75)
    fill(dimmedFill)
    triangle(x + 0.25 * size, y + 0.25 * size, x + 0.25 * size, y + 0.75 * size, x + 0.75 * size, y + 0.5 * size)
  } else {
    noStroke()
    var dimmedFill = color(COLORS.ui.levels)
    dimmedFill.setAlpha(75)
    fill(dimmedFill)
    rect(x + 0.25 * size, y + 0.25 * size, 0.2 * size, 0.5 * size)
    rect(x + 0.55 * size, y + 0.25 * size, 0.2 * size, 0.5 * size)
  }

  // Display framerate
  noStroke()
  fill(COLORS.ui)
  textAlign(LEFT, TOP)
  textSize(displaySettings.canvasSize * 0.02)
  text(frameRate().toFixed(1), displaySettings.canvasSize * 0.02, displaySettings.canvasSize * 0.02)

  // Handle text input from text areas
  if (selectedProgramID == -1) {
    // Clear text area inputs if no control particle is selected
    updateFunctionInput.elt.value = ""
    connectionFunctionInput.elt.value = ""
    signalFunctionInput.elt.value = ""
    delayFunctionInput.elt.value = ""
    internalStateInput.elt.value = ""
    delayInput.elt.value = ""
  } else {
    var particle = findParticle(simulationState.particles, selectedProgramID)
    if (particle == null) {
      selectedProgramID = -1
    } else {
      particle.state.updateFunction = updateFunctionInput.elt.value
      particle.state.connectionFunction = connectionFunctionInput.elt.value
      particle.state.signalFunction = signalFunctionInput.elt.value
      particle.state.delayFunction = delayFunctionInput.elt.value
      var translatedInternalState = stringToNumberList(internalStateInput.elt.value)
      if (translatedInternalState != null) {
        particle.state.memory = translatedInternalState
      }
      var translatedDelay = Number(delayInput.elt.value)
      if (!isNaN(translatedDelay)) {
        particle.state.updateDelay = translatedDelay
      }
    }
  }
}

function mousePressed() {
  if (mouseX >= 0 && mouseX < displaySettings.canvasSize && mouseY >= 0 && mouseY < displaySettings.canvasSize) {
    var buttonPressed = false
    var size = displaySettings.canvasSize * displaySettings.actionIconSize
    for (var a in ACTION) {
      var index = ACTION[a]
      var actionPos = actionPosition(index, displaySettings)
      var dx = mouseX - actionPos.x
      var dy = mouseY - actionPos.y
      if (dx >= 0 && dx < size && dy >= 0 && dy < size) {
        selectedActionIndex = index
        buttonPressed = true
      }
    }
    var pauseX = displaySettings.canvasSize * (1 - (displaySettings.pauseIconSize + displaySettings.pauseIconBuffer))
    var pauseY = displaySettings.canvasSize * (1 - (displaySettings.pauseIconSize + displaySettings.pauseIconBuffer + displaySettings.speedIconSize + displaySettings.speedIconBuffer * 2))
    var pauseSize = displaySettings.canvasSize * displaySettings.pauseIconSize
    var pauseDx = mouseX - pauseX
    var pauseDy = mouseY - pauseY
    if (pauseDx >= 0 && pauseDx < pauseSize && pauseDy >= 0 && pauseDy < pauseSize) {
      togglePause()
      buttonPressed = true
    }

    var speedDownX = displaySettings.canvasSize * (1 - (displaySettings.speedIconSize * 2 + displaySettings.speedIconBuffer * 3))
    var speedDownY = displaySettings.canvasSize * (1 - (displaySettings.speedIconSize + displaySettings.speedIconBuffer))
    var speedDownSize = displaySettings.canvasSize * displaySettings.speedIconSize
    var speedDownDx = mouseX - speedDownX
    var speedDownDy = mouseY - speedDownY
    if (speedDownDx >= 0 && speedDownDx < speedDownSize && speedDownDy >= 0 && speedDownDy < speedDownSize) {
      if (displaySettings.timestepsPerFrameExponent > 0) {
        displaySettings.timestepsPerFrameExponent--
      }
      buttonPressed = true
    }

    var speedUpX = displaySettings.canvasSize * (1 - (displaySettings.speedIconSize + displaySettings.speedIconBuffer))
    var speedUpY = displaySettings.canvasSize * (1 - (displaySettings.speedIconSize + displaySettings.speedIconBuffer))
    var speedUpSize = displaySettings.canvasSize * displaySettings.speedIconSize
    var speedUpDx = mouseX - speedUpX
    var speedUpDy = mouseY - speedUpY
    if (speedUpDx >= 0 && speedUpDx < speedUpSize && speedUpDy >= 0 && speedUpDy < speedUpSize) {
      displaySettings.timestepsPerFrameExponent++
      buttonPressed = true
    }

    if (!buttonPressed) {
      pos = worldPos({
        x: mouseX,
        y: mouseY
      }, displaySettings)
      switch (selectedActionIndex) {
        case ACTION.createControl:
          simulationState.particles.push(newParticle(pos.x, pos.y, PARTICLE.control))
          break
        case ACTION.createGrabber:
          simulationState.particles.push(newParticle(pos.x, pos.y, PARTICLE.binder))
          break
        case ACTION.createEnergy:
          simulationState.particles.push(newParticle(pos.x, pos.y, PARTICLE.energy))
          break
        case ACTION.createBattery:
          simulationState.particles.push(newParticle(pos.x, pos.y, PARTICLE.battery))
          break
        case ACTION.createMover:
          simulationState.particles.push(newParticle(pos.x, pos.y, PARTICLE.mover))
          break
        case ACTION.fling:
          var closestSquareDistance = Infinity
          for (var particle of simulationState.particles) {
            var squareD = squareDist(pos, particle)
            if (squareD < closestSquareDistance) {
              closestSquareDistance = squareD
              selectedFlingID = particle.id
            }
          }
          break
        case ACTION.destroyParticle:
          var closestSquareDistance = Infinity
          var closestIndex = -1
          for (var i = 0; i < simulationState.particles.length; i++) {
            var squareD = squareDist(pos, simulationState.particles[i])
            if (squareD < closestSquareDistance) {
              closestSquareDistance = squareD
              closestIndex = i
            }
          }
          if (closestIndex != -1) {
            simulationState.particles.splice(closestIndex, 1)
          }
          break
        case ACTION.program:
          var closestSquareDistance = Infinity
          for (var particle of simulationState.particles) {
            if (particle.type == PARTICLE.control) {
              var squareD = squareDist(pos, particle)
              if (squareD < closestSquareDistance) {
                closestSquareDistance = squareD
                selectedProgramID = particle.id
              }
            }
          }
          if (selectedProgramID != -1) {
            var particle = findParticle(simulationState.particles, selectedProgramID)
            updateFunctionInput.elt.value = particle.state.updateFunction
            connectionFunctionInput.elt.value = particle.state.connectionFunction
            signalFunctionInput.elt.value = particle.state.signalFunction
            delayFunctionInput.elt.value = particle.state.delayFunction
            internalStateInput.elt.value = particle.state.memory.toString()
            delayInput.elt.value = particle.state.updateDelay.toString()
          }
          break
        case ACTION.inspect:
          var closestSquareDistance = Infinity
          for (var particle of simulationState.particles) {
            var squareD = squareDist(pos, particle)
            if (squareD < closestSquareDistance) {
              closestSquareDistance = squareD
              selectedInspectID = particle.id
            }
          }
          break
      }
    }
  }
}

function mouseReleased() {
  switch (selectedActionIndex) {
    case ACTION.fling:
      if (selectedFlingID != -1) {
        var particle = findParticle(simulationState.particles, selectedFlingID)
        var end = worldPos({
          x: mouseX,
          y: mouseY
        }, displaySettings)
        var dx = end.x - particle.x
        var dy = end.y - particle.y
        particle.velocity.x += dx * displaySettings.flingPowerFactor / particle.mass
        particle.velocity.y += dy * displaySettings.flingPowerFactor / particle.mass
        selectedFlingID = -1
      }
      break
  }
}

function keyPressed(event) {
  if (!inTextBox()) {
    if (key == "f") {
      selectedActionIndex = ACTION.fling
    }
    if (key == "p") {
      selectedActionIndex = ACTION.program
    }
    if (key == "i") {
      selectedActionIndex = ACTION.inspect
    }
    if (key == "x") {
      selectedActionIndex = ACTION.destroyParticle
    }
    if (key == " ") {
      togglePause()
      event.preventDefault()
    }
    for (var a in ACTION) {
      var index = ACTION[a]
      if (index <= ACTION_ROW_SEPARATOR) {
        if (str(index + 1) == key) {
          selectedActionIndex = index
        }
      }
    }
    if (key != "w" && key != "a" && key != "s" && key != "d") {
      selectedProgramID = -1
    }
  }
}

function mouseWheel(event) {
  if (mouseX >= 0 && mouseX < displaySettings.canvasSize && mouseY >= 0 && mouseY < displaySettings.canvasSize) {
    displaySettings.zoom = max(0, min(1, displaySettings.zoom * displaySettings.zoomFactor ** -event.delta))
    event.preventDefault()
  }
}
