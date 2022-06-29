import { addressesMainnet, addressesMumbai } from './addresses.js';

"use strict";

/**
 * Example JavaScript code that interacts with the page and Web3 wallets
 */


// Unpkg imports
const Web3Modal = window.Web3Modal.default;
// const WalletConnectProvider = window.WalletConnectProvider.default;
// const Fortmatic = window.Fortmatic;
const evmChains = window.evmChains;

// Web3modal instance
let web3Modal

// Chosen wallet provider given by the dialog window
let provider;
let signer;

const addresses = addressesMainnet;

const tokenDecimals = {
  BCT: 18,
  NCT: 18,
  MATIC: 18,
  USDC: 6,
  WWETH: 18,
  WMATIC: 18
};

class BigNumber {

  constructor(bigNumberOrString, decimals) {
    this.decimals = decimals
    if (typeof bigNumberOrString === "string") {
      this.string = bigNumberOrString;
    } else if (bigNumberOrString._isBigNumber) {
      this.string = parseFloat(ethers.utils.formatUnits(bigNumberOrString, decimals)).toFixed(4);
    } else if (typeof bigNumberOrString === "number") {
      this.string = parseFloat(bigNumberOrString).toFixed(4);
    } else {
      throw "Unexpected type whilst creating BigNumber: " + typeof bigNumberOrString;
    }
  }

  asString() {
    return parseFloat(this.string).toPrecision(4);
  }

  asBigNumber() {
    return ethers.utils.parseEther(this.string, this.decimals);
  }

  asFloat() {
    return parseFloat(this.string);
  }
}

// Initial values
let carbonToOffset = new BigNumber("0.0", tokenDecimals[18]);
let paymentToken = "MATIC";
let paymentAmount = new BigNumber("0.0", tokenDecimals[paymentToken]);
let flightDistance = 0;
let isConnected = false;

import { airports } from './resources/airports_selected.js'

let airportsList = airports.map(value => {
  return value[0]
});

/**
 * Setup the orchestra
 */
function init() {

  console.log("Initializing");
  // console.log("WalletConnectProvider is", WalletConnectProvider);
  // console.log("Fortmatic is", Fortmatic);
  // console.log("window.web3 is", window.web3, "window.ethereum is", window.ethereum);

  // Check that the web page is run in a secure context,
  // as otherwise MetaMask won't be available
  // if(location.protocol !== 'https:') {
  //   // https://ethereum.stackexchange.com/a/62217/620
  //   const alert = document.querySelector("#alert-error-https");
  //   alert.style.display = "block";
  //   document.querySelector("#btn-connect").setAttribute("disabled", "disabled")
  //   return;
  // }

  // Tell Web3modal what providers we have available.
  // Built-in web browser provider (only one can exist as a time)
  // like MetaMask, Brave or Opera is added automatically by Web3modal
  const providerOptions = {
    // walletconnect: {
    //   package: WalletConnectProvider,
    //   options: {
    //     // haurogs key
    //     infuraId: "95a164372c0a4d0f8847bc5c173c9fa0",
    //   }
    // },

    // fortmatic: {
    //   package: Fortmatic,
    //   options: {
    //     // Mikko's TESTNET api key
    //     key: "pk_test_391E26A3B43A3350"
    //   }
    // }
  };

  web3Modal = new Web3Modal({
    cacheProvider: false, // optional
    providerOptions, // required
    disableInjectedProvider: false, // optional. For MetaMask / Brave / Opera.
  });
  disableOffsetButton();
  console.log("Web3Modal instance is", web3Modal);
}

async function createContractObject() {
  let jsonFile = "./ABI/OffsetHelper_" + addresses["offsetHelper"] + ".json";
  var offsetHelperABI = await $.getJSON(jsonFile);
  window.offsetHelper = new ethers.Contract(addresses["offsetHelper"], offsetHelperABI, window.provider);
  window.offsetHelperWithSigner = window.offsetHelper.connect(window.signer);
}

/**
 * Kick in the UI action after Web3modal dialog has chosen a provider
 */
async function fetchAccountData() {
  // calculate carbon emission
  await calculateFlightDistance();
  updateUIvalues();

  // Display fully loaded UI for wallet data
  document.querySelector("#connect-button-div").style.display = "none";
  document.querySelector("#disconnect-button-div").style.display = "block";
  // TODO
  // document.querySelector("#connected").style.display = "block";
}

async function updateUIvalues() {
  window.paymentToken = paymentToken;
  window.paymentAmount = paymentAmount;

  if (window.flightDistance >= 0) {
    var fieldDistance = document.getElementById("distance");
    // TODO stats
    // fieldDistance.value = window.flightDistance.toFixed(1) + " km";
    fieldDistance.innerHTML = window.flightDistance.toFixed(0) + " km";
  }
  var fieldCarbonToOffset = document.getElementById("carbon-to-offset");
  if (window.carbonToOffset.asFloat()) {
    // TODO stats
    fieldCarbonToOffset.value = window.carbonToOffset.asString();
    // fieldCarbonToOffset.innerHTML = window.carbonToOffset.asString() + " TCO2";
  }

  // console.log("connected: ", window.isConnected)
  if (window.isConnected && (window.carbonToOffset.asFloat())) {
    await updatePaymentFields();
  }
}

/**
 * Fetch account data for UI when
 * - User switches accounts in wallet
 * - User switches networks in wallet
 * - User connects wallet initially
 */
async function refreshAccountData() {
  // If any current data is displayed when
  // the user is switching accounts in the wallet
  // immediate hide this data
  // document.querySelector("#connected").style.display = "none";

  document.querySelector("#connect-button-div").style.display = "block";
  document.querySelector("#disconnect-button-div").style.display = "none";

  // Disable button while UI is loading.
  // fetchAccountData() will take a while as it communicates
  // with Ethereum node via JSON-RPC and loads chain data
  // over an API call.
  document.querySelector("#btn-connect").setAttribute("disabled", "disabled")
  await fetchAccountData(window.provider);
  document.querySelector("#btn-connect").removeAttribute("disabled")
}

async function updatePaymentFields() {
  window.paymentToken = await document.querySelector("#list-payment-tokens").value;
  // console.log("Payment token changed: ", window.paymentToken);
  // console.log("Connected:", window.isConnected);
  // console.log("Carbon to offset: ", window.carbonToOffset.asString());
  if (window.isConnected !== true) {
    console.log("skipping update of payment costs; wallet not connected")
    return;
  }
  if (window.carbonToOffset.asFloat() < 0.001) {
    console.log("No carbon emission to offset. Skipping calculation.")
    return;
  }
  switch (window.paymentToken) {
    case "MATIC":
      await calculateRequiredMaticPaymentForOffset();
      window.balance = await getMaticBalance();
      hideApproveButton();
      enableOffsetButton();
      break;
    case "USDC":
    case "WMATIC":
    case "WETH":
    case "NCT":
      await calculateRequiredTokenPaymentForOffset();
      await createErc20Contract();
      window.balance = await getErc20Balance();
      showApproveButton();
      disableOffsetButton();
      break;
    default:
      console.log("Unsupported token! ", window.paymentToken);
      // TODO: better error message propagation in UI
      var fieldpaymentAmount = document.getElementById("payment-amount");
      fieldpaymentAmount.value = "unsupported token";
  }
  updatePaymentAmountField();
  updateBalanceField();
}

function showApproveButton() {
  let approveButton = document.getElementById("btn-approve");
  approveButton.setAttribute("style", "display:true");
}

function hideApproveButton() {
  let approveButton = document.getElementById("btn-approve");
  approveButton.setAttribute("style", "display:none");
}

function busyApproveButton() {
  let approveButton = document.getElementById("btn-approve");
  approveButton.innerHTML = "";
  approveButton.classList.add("loading");
}

function readyApproveButton() {
  let approveButton = document.getElementById("btn-approve");
  approveButton.classList.remove("loading");
  approveButton.innerHTML = "Approve";
}

function disableOffsetButton() {
  let offsetButton = document.getElementById("btn-offset");
  offsetButton.setAttribute("disabled", "disabled");
}

function enableOffsetButton() {
  let offsetButton = document.getElementById("btn-offset");
  offsetButton.removeAttribute("disabled");
}

function busyOffsetButton() {
  let offsetButton = document.getElementById("btn-offset");
  offsetButton.innerHTML = "";
  offsetButton.classList.add("loading");
}

function readyOffsetButton() {
  let offsetButton = document.getElementById("btn-offset");
  offsetButton.classList.remove("loading");
  offsetButton.innerHTML = "Offset";
}

function updatePaymentAmountField() {
  var paymentAmountField = document.getElementById("payment-amount");
  paymentAmountField.innerHTML = window.paymentAmount.asString();
}

function updateBalanceField() {
  var balanceField = document.getElementById("balance");
  balanceField.innerHTML = "Balance: " + window.balance.asString() + " " + window.paymentToken;
}

async function calculateRequiredMaticPaymentForOffset() {

  let amount = await window.offsetHelper
    .calculateNeededETHAmount(addresses['NCT'], window.carbonToOffset.asBigNumber());
  window.paymentAmount = new BigNumber(amount, tokenDecimals[window.paymentToken]);
}

async function calculateRequiredTokenPaymentForOffset() {
  if (window.paymentToken === "NCT") {
    window.paymentAmount = new BigNumber(window.carbonToOffset.asBigNumber(), tokenDecimals[window.paymentToken]);
  } else {
    let amount = await window.offsetHelper
      .calculateNeededTokenAmount(addresses[window.paymentToken], addresses['NCT'], window.carbonToOffset.asBigNumber());
    window.paymentAmount = new BigNumber(amount, tokenDecimals[window.paymentToken]);
  }
}

async function getMaticBalance() {
  let balance = await window.provider.getBalance(window.signer.getAddress());
  return new BigNumber(balance, tokenDecimals["MATIC"]);
}

async function createErc20Contract() {
  let jsonFile = "./ABI/ERC20.json";
  var erc20ABI = await $.getJSON(jsonFile);
  window.erc20Contract = new ethers.Contract(addresses[window.paymentToken], erc20ABI, window.provider);
}

async function getErc20Balance() {
  let balance = await window.erc20Contract.balanceOf(window.signer.getAddress());
  return new BigNumber(balance, tokenDecimals[window.paymentToken]);
}

async function approveErc20() {
  busyApproveButton();
  // console.log("Approving", addresses["offsetHelper"], "to deposit", window.paymentAmount.asString(), window.paymentToken);
  try {
    const erc20WithSigner = window.erc20Contract.connect(window.signer);
    const transaction = await erc20WithSigner.approve(addresses["offsetHelper"], window.paymentAmount.asBigNumber());
    await transaction.wait();
    readyApproveButton();
    enableOffsetButton();
  } catch (e) {
    readyApproveButton();
    throw e;
  }
}

async function doAutoOffset() {
  // console.log("AutoOffsetting with:", window.paymentToken);
  // console.log("Connected:", window.isConnected);
  if (window.isConnected !== true) {
    console.log("skipping auto offset costs; wallet not connected")
    return;
  }
  switch (window.paymentToken) {
    case "MATIC":
      await doAutoOffsetUsingETH();
      break;
    case "USDC":
    case "WMATIC":
    case "WETH":
      await doAutoOffsetUsingToken();
      break;
    case "NCT":
      await doAutoOffsetUsingPoolToken();
      break;
    default: console.log("Unsupported token! ", window.paymentToken);
  }
}

async function doAutoOffsetUsingETH() {
  // Update matic value before sending txn to account for any price change
  // (an outdated value can lead to gas estimation error)
  await calculateRequiredMaticPaymentForOffset();
  busyOffsetButton();
  try {
    const txReceipt = await window.offsetHelperWithSigner
      .autoOffsetUsingETH(addresses['NCT'], window.carbonToOffset.asBigNumber(), { value: window.paymentAmount.asBigNumber() });
    await transaction.wait();
    readyOffsetButton();
  } catch (e) {
    readyOffsetButton();
    throw e;
  }

}

async function doAutoOffsetUsingToken() {
  // Update token amount before sending txn to account for any price change
  // (an outdated value can lead to gas estimation error)
  await calculateRequiredTokenPaymentForOffset();
  busyOffsetButton();
  try {
    const txReceipt = await window.offsetHelperWithSigner
      .autoOffsetUsingToken(addresses[window.paymentToken], addresses['NCT'], window.carbonToOffset.asBigNumber());
    await transaction.wait();
    readyOffsetButton();
  } catch (e) {
    readyOffsetButton();
    throw e;
  }
}

async function doAutoOffsetUsingPoolToken() {
  busyOffsetButton();
  try {
    const txReceipt = await window.offsetHelperWithSigner
      .autoOffsetUsingPoolToken(addresses['NCT'], window.carbonToOffset.asBigNumber());
    await transaction.wait();
    readyOffsetButton();
  } catch (e) {
    readyOffsetButton();
    throw e;
  }
}

/**
 * Creates Locations from Latitude Longitude. Usage: let pointA = new Location(x.xx, x.xx)
 */
function Location(latitude, longitude) {
  this.latitude = latitude;
  this.longitude = longitude;
}


/**
 * transforms an angle from dgrees to radians
 */
function toRad(angle) {
  return angle * Math.PI / 180;
}

/**
 * Calculates the distance on the earth surface given by two points Start and Destination
 * https://en.wikipedia.org/wiki/Great-circle_distance#Formulas Vyncenty formula
 */
function calcGeodesicDistance(start, destination) {
  const earthRadius = 6371.009; // km mean earth radius (spherical approximation)

  // Calculate temporary elements of the formula:

  let deltaLambda = (destination.longitude - start.longitude);

  let A = Math.pow(
    Math.cos(toRad(destination.latitude)) *
    Math.sin(toRad(deltaLambda))
    , 2);

  let B = Math.pow(
    Math.cos(toRad(start.latitude)) * Math.sin(toRad(destination.latitude)) -
    Math.sin(toRad(start.latitude)) * Math.cos(toRad(destination.latitude)) *
    Math.cos(toRad(deltaLambda))
    , 2);

  let C = Math.sin(toRad(start.latitude)) * Math.sin(toRad(destination.latitude)) +
    Math.cos(toRad(start.latitude)) * Math.cos(toRad(destination.latitude)) *
    Math.cos(toRad(deltaLambda));

  // Vyncenty formula:
  let deltaSigma = Math.atan2(Math.sqrt(A + B), C);
  let distance = earthRadius * deltaSigma;
  return distance;
}

/**
 * Check the correct network id is used.
 */
async function isCorrectChainId(chainId) {
  console.log("chainId: ", chainId)
  // if (chainId !== 80001) {
  if (chainId !== 137) {
    document.getElementById("Network-Warning-Modal").checked = true;
    return false;
  } else {
    document.querySelector("#btn-connect").removeAttribute("disabled")
    return true;
  }
}

/**
 * Connect wallet button pressed.
 */
async function onConnect() {

  console.log("Opening a dialog", web3Modal);

  let instance
  try {
    instance = await web3Modal.connect();
    window.provider = new ethers.providers.Web3Provider(instance);
    window.signer = window.provider.getSigner();
  } catch (e) {
    console.log("Could not get a wallet connection", e);
    return;
  }

  window.carbonToOffset = carbonToOffset;
  window.paymentAmount = paymentAmount;

  let correctChainId
  const { chainId } = await window.provider.getNetwork();
  correctChainId = await isCorrectChainId(chainId);
  // Subscribe to accounts change
  window.provider.provider.on("accountsChanged", (accounts) => {
    fetchAccountData();
    console.log("accounts Changed");
  });

  // Subscribe to chainId change
  window.provider.provider.on("chainChanged", (chainId) => {
    console.log("chain Changed", chainId);
    correctChainId = isCorrectChainId(parseInt(chainId, 16));
    if (correctChainId) {
      fetchAccountData();
    } else {
      onDisconnect();
    }

  });

  if (correctChainId === false) {
    console.log("wrong network, disconnect")
    onDisconnect();
    return;
  }

  window.isConnected = true;
  console.log("window signer", window.signer)
  await createContractObject();

  var el = document.getElementById("btn-offset");
  if (el.addEventListener) el.addEventListener("click", doAutoOffset, false);
  else if (el.attachEvent) el.attachEvent("onclick", doAutoOffset);

  var btnApprove = document.getElementById("btn-approve");
  if (btnApprove.addEventListener) btnApprove.addEventListener("click", approveErc20, false);
  else if (btnApprove.attachEvent) btnApprove.attachEvent("onclick", approveErc20);

  await refreshAccountData();
  await handleManuallyEnteredTCO2();
  await updatePaymentFields();
}

/**
 * Disconnect wallet button pressed.
 */
async function onDisconnect() {

  console.log("Killing the wallet connection", window.provider);

  // TODO: Which providers have close method?
  if (window.provider.close) {
    await window.provider.close();

    // If the cached provider is not cleared,
    // WalletConnect will default to the existing session
    // and does not allow to re-scan the QR code with a new wallet.
    // Depending on your use case you may want or want not his behavir.
    await web3Modal.clearCachedProvider();
    window.provider = null;
  }

  // Set the UI back to the initial state
  document.querySelector("#connect-button-div").style.display = "block";
  document.querySelector("#disconnect-button-div").style.display = "none";

  // TODO
  // document.querySelector("#connected").style.display = "none";

  window.isConnected = false;
}

function decrement(e) {
  const btn = e.target.parentNode.parentElement.querySelector(
    'button[data-action="decrement"]'
  );
  const target = btn.nextElementSibling;
  let value = Number(target.value);
  if (value > 1) {
    value--;
  }
  target.value = value;
  calculateFlightDistance();
}

function increment(e) {
  const btn = e.target.parentNode.parentElement.querySelector(
    'button[data-action="decrement"]'
  );
  const target = btn.nextElementSibling;
  let value = Number(target.value);
  value++;
  target.value = value;
  calculateFlightDistance();
}

const decrementButtons = document.querySelectorAll(
  `button[data-action="decrement"]`
);

const incrementButtons = document.querySelectorAll(
  `button[data-action="increment"]`
);

decrementButtons.forEach(btn => {
  btn.addEventListener("click", decrement);
});

incrementButtons.forEach(btn => {
  btn.addEventListener("click", increment);
});


/**
 * Find Latitude and Longitude from airport name
 */
async function findLatLong(airportName) {

  // let airportName = "Zürich Airport, Zurich CH, ZRH"
  let result = await airports.find(element => element[0] == airportName)

  // console.log("Location:", result)
  let location = new Location(result[1], result[2]);
  return location
}

/**
 * Get flight distance from the two airport input fields
 */
async function calculateFlightDistance() {

  let startName = document.getElementById('start').value
  let startLocation;
  if (startName) {
    startLocation = await findLatLong(startName)
  }

  let destinationName = document.getElementById('destination').value
  let destinationLocation;
  if (destinationName) {
    destinationLocation = await findLatLong(destinationName)
  }


  // console.log("Locations:", startLocation, " ", destinationLocation)

  if (startLocation && destinationLocation) {
    window.flightDistance = calcGeodesicDistance(startLocation, destinationLocation)
    // console.log("Distance: ", window.flightDistance)
    calculateCarbonEmission();
  }
}

/**
 * get carbon emission from distance and other fields
 */
async function calculateCarbonEmission() {
  // Formula follows myclimate estimation calculator
  // emission parameters (short distance)
  let emShort = {
    a: 0,
    b: 2.714,
    c: 1166.52,
    S: 153.51,
    PLF: 0.82,
    DC: 95,
    CF: 0.07,
    CW: {
      economy: 0.96,
      business: 1.26,
      first: 2.4,
    },
    EF: 3.15,
    M: 2,
    P: 0.54,
    AF: 0.00038,
    A: 11.68
  }
  // emission parameters (long distance)
  let emLong = {
    a: 0.0001,
    b: 7.104,
    c: 5044.93,
    S: 280.21,
    PLF: 0.82,
    DC: 95,
    CF: 0.23,
    CW: {
      economy: 0.8,
      business: 1.54,
      first: 2.4,
    },
    EF: 3.15,
    M: 2,
    P: 0.54,
    AF: 0.00038,
    A: 11.68
  }

  let emission = 0;
  if (window.flightDistance == 0) {
    // do nothing
  } else if (window.flightDistance < 1500) {  // short distance
    emission = singleEmissionCalc(emShort);
  } else if (window.flightDistance > 2500) {  // long distance
    emission = singleEmissionCalc(emLong);
  } else {  // intermediate distance (interpolation)
    let shortEM = singleEmissionCalc(emShort);
    let longEM = singleEmissionCalc(emLong);
    let longDistFactor = (window.flightDistance - 1500) / 1000; // 0@1500km, 1@2500km
    // console.log("longdistancefactor: ", longDistFactor);
    // console.log("shortEM: ", shortEM);
    // console.log("longEM: ", longEM);
    emission = (1 - longDistFactor) * shortEM + longDistFactor * longEM; //interpolation
  }

  // Handle multipliers and input from other fields
  let passengers = document.getElementById("passengers").value;
  emission *= passengers;

  let roundTrip = document.getElementById("roundtrip").checked;
  if (roundTrip) {
    emission *= 2;
  }
  // console.log("user entered ", emission, typeof emission)
  window.carbonToOffset = new BigNumber(emission, tokenDecimals["NCT"]);
  // console.log("Carbon Emission: ", emission);
  await updatePaymentFields();
  updateUIvalues();
}

/**
* calculates CO2 emission for an emission parameter set (em)
*/
function singleEmissionCalc(em) {

  let flightclass = document.getElementById("flightclass").value;
  // console.log("flightclass: ", flightclass);
  let emission = 0;
  let d = window.flightDistance + em.DC;
  emission = ((em.a * d * d + em.b * d + em.c) / (em.S * em.PLF)) *
    (1 - em.CF) *
    em.CW[flightclass] *
    (em.EF * em.M + em.P) +
    em.AF * d +
    em.A;
  // console.log("emissioncalc: ", emission)
  emission = (emission / 1000).toFixed(3); // from kg to tonnes
  return emission
}

async function handleManuallyEnteredTCO2() {
  // console.log("manual change:")
  let TCO2 = parseFloat(document.getElementById("carbon-to-offset").value);
  // console.log("user entered ", TCO2, typeof TCO2)
  if (TCO2 && TCO2 > 0) {
    window.carbonToOffset = new BigNumber(TCO2, tokenDecimals["NCT"]);
  }
  // console.log("Carbon Emission: ", TCO2);
  updateUIvalues();
}


/**
 * Make autocomplete list for airports
 */
$(function () {
  $("#start").autocomplete({
    maxShowItems: 6,
    source: airportsList,
    minLength: 2,
    select: function (event, ui) {
      // somehow this needs to be set manually here, otherwise the UI will
      // not update properly. (For the other jQuery it works without it...)
      let startField = document.getElementById("start");
      startField.value = ui.item.value;
      calculateFlightDistance();
    }
  }).focus(function () {
    $(this).autocomplete('search', $(this).val())
  }).autocomplete("instance")._renderItem = function (ul, item) {
    return $("<li>")
      .append('<div style="font-size:20px;">' + item.label.split(",")[1] + "<br>" +
        '<span style="font-size:16px;"><b>' + item.label.split(",")[0] + "</b>, " +
        item.label.split(",")[2] + ", " +
        item.label.split(",")[3] +
        "</small></div>")
      .appendTo(ul);
  };
});

$(function () {
  $("#destination").autocomplete({
    maxShowItems: 6,
    source: airportsList,
    minLength: 2,
    select: function (event, ui) { calculateFlightDistance() }
  }).focus(function () {
    $(this).autocomplete('search', $(this).val())
  }).autocomplete("instance")._renderItem = function (ul, item) {
    return $("<li>")
      .append('<div style="font-size:20px;">' + item.label.split(",")[1] + "<br>" +
        '<span style="font-size:16px;"><b>' + item.label.split(",")[0] + "</b>, " +
        item.label.split(",")[2] + ", " +
        item.label.split(",")[3] +
        "</span></div>")
      .appendTo(ul);
  };
});




/**
 * Main entry point.
 */
window.addEventListener('load', async () => {
  init();
  document.querySelector("#btn-connect").addEventListener("click", onConnect);
  document.querySelector("#btn-disconnect").addEventListener("click", onDisconnect);
  document.querySelector("#list-payment-tokens").addEventListener("change", updateUIvalues);
  document.querySelector("#roundtrip").addEventListener("click", calculateFlightDistance);
  document.querySelector('#flightclass').addEventListener("change", calculateFlightDistance);
  document.querySelector('#carbon-to-offset').addEventListener("change", handleManuallyEnteredTCO2);
  document.querySelector('#passengers').addEventListener("change", calculateFlightDistance);
});
