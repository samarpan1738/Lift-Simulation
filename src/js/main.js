const floorPlanForm = document.getElementById("floor-plan-form");
const plot = document.getElementById("plot");
const LIFT_DIRECTION = {
	UP: "Up",
	DOWN: "Down",
};
const CLASSNAMES = {
	LIFT_SECTION: "lift-section",
};
const BUTTON_STATE = {
	ON: "on",
	OFF: "off",
};
const LIFT_STATE = {
	BUSY: "busy",
	FREE: "free",
};
const TIME_PER_FLOOR = 2;
let liftNumberToState = null;
let floorToLifts = null;
let queue = null;
let DISTANCE_BETWEEN_TWO_FLOORS = null;
const POLLING_INTERVAL_IN_MS = 1000;
let TOTAL_FLOORS = 0,
	TOTAL_LIFTS = 0;
let freeLifts = new Set();
floorPlanForm.addEventListener("submit", (e) => {
	e.preventDefault();
	const fd = new FormData(e.target);
	const isValidData = validateFloorPlanFormData(fd);
	if (!isValidData) return;
	const floorCount = parseInt(fd.get("floor-count"));
	const liftCount = parseInt(fd.get("lift-count"));
	console.log(`floorCount : ${floorCount} , liftCount : ${liftCount}`);
	TOTAL_FLOORS = floorCount;
	TOTAL_LIFTS = liftCount;
	setupFloorAndLifts(floorCount, liftCount);
});

function validateFloorPlanFormData(fd) {
	let floorCount = fd.get("floor-count");
	let liftCount = fd.get("lift-count");
	if (floorCount.length === 0 || liftCount.length === 0) {
		if (floorCount.length === 0 && liftCount.length === 0) alert("Blank floor and lift count");
		else if (floorCount.length === 0) alert("Blank floor count");
		else alert("Blank lift count");
		return false;
	}
	floorCount = parseInt(floorCount);
	liftCount = parseInt(liftCount);
	if (floorCount <= 0) {
		alert("Sorry! We don't support travel to the upside down");
		return false;
	}
	if (floorCount === 1) {
		alert("Why do you need a lift for single floor??");
		return false;
	}
	if (liftCount <= 0) {
		alert("Duh! There's no point of a lift simulator without lifts");
		return false;
	}
	if (liftCount > 7) {
		alert("Max 7 lifts allowed");
		return false;
	}
	return true;
}

function setupFloorAndLifts(floorCount, liftCount) {
	const fragment = document.createDocumentFragment();
	liftNumberToState = {};
	floorToLifts = {};
	queue = [];
	let firstFloor = null;
	for (let floorNumber = floorCount; floorNumber >= 1; --floorNumber) {
		const floor = createFloor(floorNumber, floorCount, liftCount);
		if (floorNumber === 1) firstFloor = floor;
		fragment.appendChild(floor);
	}
	console.log(firstFloor.getElementsByClassName(CLASSNAMES.LIFT_SECTION).item(0));
	for (let liftNumber = 1; liftNumber <= liftCount; ++liftNumber) {
		freeLifts.add(liftNumber);
		firstFloor.getElementsByClassName(CLASSNAMES.LIFT_SECTION).item(0).appendChild(createLift(liftNumber));
	}
	plot.innerHTML = "";
	plot.appendChild(fragment);
	const baseFs = parseInt(getComputedStyle(document.querySelector("body")).fontSize);
	DISTANCE_BETWEEN_TWO_FLOORS =
		(document.querySelector(`.floor[data-number="1"]`).getBoundingClientRect().y -
			document.querySelector(`.floor[data-number="2"]`).getBoundingClientRect().y) /
		baseFs;
	console.log(`DISTANCE_BETWEEN_TWO_FLOORS : ${DISTANCE_BETWEEN_TWO_FLOORS}`);
}

function createFloor(floorNumber, totalFloors, totalLifts) {
	const floor = document.createElement("div");
	floor.dataset.number = floorNumber;
	floor.classList.add("floor");
	const floorTitle = document.createElement("div");
	floorTitle.innerText = `Floor #${floorNumber}`;
	const liftSection = document.createElement("div");
	liftSection.classList.add(CLASSNAMES.LIFT_SECTION);

	addButtonsToFloor(floorNumber, floor, totalFloors, totalLifts);
	floor.appendChild(liftSection);
	floor.appendChild(floorTitle);
	return floor;
}

function addButtonsToFloor(floorNumber, floor, totalFloors, totalLifts) {
	const buttonContainer = document.createElement("div");
	buttonContainer.classList.add("button-container");
	if (floorNumber !== totalFloors) {
		const upButton = document.createElement("button");
		upButton.type = "button";
		upButton.classList.add("up-button");
		upButton.innerText = "↑";
		upButton.dataset.direction = LIFT_DIRECTION.UP;
		upButton.addEventListener("click", (e) =>
			handleLiftButtonClick(e.target, floor, floorNumber, totalLifts, LIFT_DIRECTION.UP)
		);
		buttonContainer.appendChild(upButton);
	}
	if (floorNumber !== 1) {
		const downButton = document.createElement("button");
		downButton.type = "button";
		downButton.classList.add("down-button");
		downButton.innerText = "↓";
		downButton.dataset.direction = LIFT_DIRECTION.DOWN;
		downButton.addEventListener("click", (e) =>
			handleLiftButtonClick(e.target, floor, floorNumber, totalLifts, LIFT_DIRECTION.DOWN)
		);
		buttonContainer.appendChild(downButton);
	}
	floor.appendChild(buttonContainer);
}
// TODO : Add logic to summon the closest STATIONARY lift
function handleLiftButtonClick(liftButton, floor, floorNumber, totalLifts, direction) {
	// Return if floor already in queue
	if (queue.indexOf(floorNumber) !== -1) return;

	if (floorToLifts[floorNumber] && floorToLifts[floorNumber].length > 0) {
		const liftNumber = floorToLifts[floorNumber][0];
		if (liftNumberToState[liftNumber].state !== LIFT_STATE.FREE) return;
		liftButton.dataset.state=BUTTON_STATE.ON;
		addDoorAnimation(getLiftByNumber(floorToLifts[floorNumber][0]));
		return;
	}

	let [liftNumber, lift] = getClosestAvailableLift(floorNumber, totalLifts);
	if (liftNumber === null) {
		liftButton.dataset.state = BUTTON_STATE.ON;
		if (queue.length === 0) startPolling();
		queue.push(floorNumber);
		return;
	}
	liftButton.dataset.state = BUTTON_STATE.ON;
	moveLiftToTargetFloor(liftNumber, lift, floorNumber);
}
function getClosestAvailableLift(floorNumber, totalLifts) {
	if (freeLifts.size === 0) return [null, null];
	let minDistance = Number.MAX_VALUE,
		closestLiftNumber = null;
	for (let liftNumber of freeLifts) {
		const currentDistance = Math.abs(floorNumber - liftNumber);
		if (minDistance > currentDistance) {
			minDistance = currentDistance;
			closestLiftNumber = liftNumber;
		}
	}
	// Check all STATIONARY lifts
	// for (let liftNumber = 1; liftNumber <= totalLifts; ++liftNumber) {
	// 	if (liftNumberToState[liftNumber].state === LIFT_STATE.FREE) {
	// 		const currentDistance = Math.abs(floorNumber - liftNumber);
	// 		if (minDistance > currentDistance) {
	// 			minDistance = currentDistance;
	// 			closestLiftNumber = liftNumber;
	// 		}
	// 	}
	// }
	// if (closestLiftNumber === null) return [null, null];
	// else {
	freeLifts.delete(closestLiftNumber);
	return [closestLiftNumber, getLiftByNumber(closestLiftNumber)];
	// }
}
function moveLiftToTargetFloor(liftNumber, lift, floorNumber) {
	// We have an available lift
	console.log(`liftNumber : ${liftNumber} , liftNumberToState : ${liftNumberToState}`);
	const liftState = liftNumberToState[liftNumber];
	const liftCurrentFloor = liftState.currentFloor;
	liftState.currentFloor = floorNumber;
	// lift.dataset.state="on"
	// Removed liftNumber from floorToLifts[liftCurrentFloor] and add liftNumber to floorToLifts[floorNumber]
	if (floorToLifts[liftCurrentFloor]) {
		console.log(`Before splice, liftCurrentFloor : ${liftCurrentFloor} : `, floorToLifts);
		floorToLifts[liftCurrentFloor].splice(floorToLifts[liftCurrentFloor].indexOf(liftNumber), 1);
		console.log("After splice : ", floorToLifts);
	}
	if (!floorToLifts[floorNumber]) floorToLifts[floorNumber] = [];
	floorToLifts[floorNumber].push(liftNumber);

	if (liftCurrentFloor < floorNumber) liftState.currentDirection = LIFT_DIRECTION.UP;
	else liftState.currentDirection = LIFT_DIRECTION.DOWN;
	liftState.state = LIFT_STATE.BUSY;
	// const { top: liftUB, bottom: liftLB } = lift.getBoundingClientRect();
	// const { top: floorUB, bottom: floorLB } = floor.getBoundingClientRect();
	// // const floor = getFloorByNumber(floorNumber);
	// console.log(
	// 	`floorNumber : ${floorNumber} , floorLB : ${floorLB}, floorUB : ${floorUB} , liftUB: ${liftUB} , liftLB : ${liftLB}`
	// );
	lift.style.transform = `translateY(-${DISTANCE_BETWEEN_TWO_FLOORS * (floorNumber - 1)}rem)`;
	lift.style.transition = `transform ${Math.abs(liftCurrentFloor - floorNumber) * TIME_PER_FLOOR}s ease-in-out`;
}

function createLift(liftNumber) {
	const lift = document.createElement("div");
	lift.dataset.number = liftNumber;
	lift.classList.add("lift");
	lift.id = `lift-${liftNumber}`;
	addLiftDoors(lift, liftNumber);
	lift.style.left = `${140 * liftNumber}px`;
	liftNumberToState[liftNumber] = {
		currentFloor: 1,
		state: LIFT_STATE.FREE,
		currentDirection: null,
	};
	lift.ontransitionend = () => {
		console.log("Add open-close animation");
		addDoorAnimation(lift);
	};
	return lift;
}
function addLiftDoors(lift, liftNumber) {
	const leftLiftDoor = document.createElement("div");
	leftLiftDoor.classList.add("lift-door");
	leftLiftDoor.dataset.side = "left";
	const rightLiftDoor = document.createElement("div");
	rightLiftDoor.dataset.side = "right";
	rightLiftDoor.classList.add("lift-door");
	// Lift reached target floor and doors are closed now
	// Pick another from queue now
	leftLiftDoor.addEventListener("animationend", () => {
		console.log("Remove left door open-close animation");
		leftLiftDoor.classList.remove("lift-door-left");
		liftNumberToState[liftNumber].state = LIFT_STATE.FREE;
		liftNumberToState[liftNumber].currentDirection = null;
		const currentFloor = getFloorByNumber(liftNumberToState[liftNumber].currentFloor);
		const buttonContainer = currentFloor.querySelector(".button-container");
		buttonContainer.querySelectorAll(`button[data-state="${BUTTON_STATE.ON}"]`).forEach((button) => {
			button.dataset.state = BUTTON_STATE.OFF;
		});
		freeLifts.add(liftNumber);
		// processQueue();
	});
	rightLiftDoor.addEventListener("animationend", () => {
		console.log("Remove right door open-close animation");
		rightLiftDoor.classList.remove("lift-door-right");
	});
	lift.appendChild(leftLiftDoor);
	lift.appendChild(rightLiftDoor);
}
function addDoorAnimation(lift) {
	getLiftDoor(lift, "left").classList.add("lift-door-left");
	getLiftDoor(lift, "right").classList.add("lift-door-right");
}
function getLiftByNumber(liftNumber) {
	return document.querySelector(`.lift[data-number="${liftNumber}"]`);
}
function getFloorByNumber(floorNumber) {
	return document.querySelector(`.floor[data-number="${floorNumber}"]`);
}

function getLiftDoor(lift, side) {
	return lift.querySelector(`.lift-door[data-side="${side}"]`);
}

function startPolling() {
	console.log("Started polling");
	let interval = setInterval(() => {
		if (queue.length === 0) {
			clearInterval(interval);
			console.log("Stopping polling");
			return;
		}
		const targetFloorNumber = queue[0];
		const [liftNumber, lift] = getClosestAvailableLift(targetFloorNumber, TOTAL_LIFTS);
		if (liftNumber != null) {
			queue.shift();
			moveLiftToTargetFloor(liftNumber, lift, targetFloorNumber);
		}
	}, POLLING_INTERVAL_IN_MS);
}
