"use strict";

/**
 * Example JavaScript code that interacts with the page and Web3 wallets
 */


// Unpkg imports
const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;
const Fortmatic = window.Fortmatic;
const evmChains = window.evmChains;

// Web3modal instance
let web3Modal

// Chosen wallet provider given by the dialog window
let provider;


// Address of the selected account
let selectedAccount;

// Addresses of used contracts

// const offsetHelperAddress = "0x79E63048B355F4FBa192c5b28687B852a5521b31";  // Used in Amsterdam
const offsetHelperAddress = "0x7229F708d2d1C29b1508E35695a3070F55BbA479";   // Newer; updated ABI
const NCTTokenAddress = "0xD838290e877E0188a4A44700463419ED96c16107";

let offsetHelper;  // contract object of the offsethelper

const tokenAddresses = {
  bct: "0x2F800Db0fdb5223b3C3f354886d907A671414A7F",
  nct: "0xD838290e877E0188a4A44700463419ED96c16107",
  usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  weth: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  wmatic: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
};

// Initial values
let carbonToOffset = "0.0000001";
let flightDistance = 0;
let paymentCurrency = "matic";
let paymentQuantity = "";
let isConnected = false;

import { airports } from './resources/airports_selected.js'

let airportsList = airports.map(value => {
  return value[0]
});


/**
 * Setup the orchestra
 */
function init() {

  console.log("Initializing example");
  console.log("WalletConnectProvider is", WalletConnectProvider);
  console.log("Fortmatic is", Fortmatic);
  console.log("window.web3 is", window.web3, "window.ethereum is", window.ethereum);

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
    walletconnect: {
      package: WalletConnectProvider,
      options: {
        // haurogs key
        infuraId: "95a164372c0a4d0f8847bc5c173c9fa0",
      }
    },

    fortmatic: {
      package: Fortmatic,
      options: {
        // Mikko's TESTNET api key
        key: "pk_test_391E26A3B43A3350"
      }
    }
  };

  web3Modal = new Web3Modal({
    cacheProvider: false, // optional
    providerOptions, // required
    disableInjectedProvider: false, // optional. For MetaMask / Brave / Opera.
  });

  console.log("Web3Modal instance is", web3Modal);
}

async function createContractObject() {
  // Load ABI
  let jsonFile = "./ABI/OffsetHelper_" + offsetHelperAddress + ".json";
  var offsetHelperABI = await $.getJSON(jsonFile);
  // let offsetHelperABI = json.abi;
  console.log(offsetHelperABI)
  const web3 = new Web3(provider);
  window.offsetHelper = await new web3.eth.Contract(offsetHelperABI, offsetHelperAddress);
}


/**
 * Kick in the UI action after Web3modal dialog has chosen a provider
 */
async function fetchAccountData() {

  // Get a Web3 instance for the wallet
  const web3 = new Web3(provider);

  console.log("Web3 instance is", web3);

  // Get connected chain id from Ethereum node
  const chainId = await web3.eth.getChainId();
  // Load chain information over an HTTP API
  const chainData = evmChains.getChain(chainId);
  // TODO
  // document.querySelector("#network-name").textContent = chainData.name;

  // Get list of accounts of the connected wallet
  const accounts = await web3.eth.getAccounts();

  // MetaMask does not give you all accounts, only the selected account
  console.log("Got accounts", accounts);
  selectedAccount = accounts[0];

  window.carbonToOffset = carbonToOffset;
  // window.flightDistance = flightDistance;  // TODO: this currently overwrites the calculated amount?
  // window.isConnected = false;
  window.paymentCurrency = paymentCurrency;
  window.paymentQuantity = paymentQuantity;

  // TODO
  // document.querySelector("#selected-account").textContent = selectedAccount.slice(0, 8) + "..." + selectedAccount.slice(-6);

  // TODO
  // const template = document.querySelector("#template-balance");
  // const accountContainer = document.querySelector("#accounts");

  // // Purge UI elements any previously loaded accounts
  // accountContainer.innerHTML = '';

  // Go through all accounts and get their ETH balance
  /*
  const rowResolvers = accounts.map(async (address) => {
    const balance = await web3.eth.getBalance(address);
    // ethBalance is a BigNumber instance
    // https://github.com/indutny/bn.js/
    const ethBalance = web3.utils.fromWei(balance, "ether");
    const humanFriendlyBalance = parseFloat(ethBalance).toFixed(4);
    // Fill in the templated row and put in the document
    const clone = template.content.cloneNode(true);
    clone.querySelector(".address").textContent = address.slice(0, 8) + "..." + address.slice(-6);
    clone.querySelector(".balance").textContent = humanFriendlyBalance;
    accountContainer.appendChild(clone);
  });
  */
  // Because rendering account does its own RPC communication
  // with Ethereum node, we do not want to display any results
  // until data for all accounts is loaded
  // await Promise.all(rowResolvers);

  // calculate carbon emission
  await calculateCarbonEmission();
  // Display matic and carbon to offset
  console.log("carbontooffset: ", window.carbonToOffset);
  await calculateRequiredMaticPaymentForOffset();

  updateUIvalues();

  // Display fully loaded UI for wallet data
  document.querySelector("#connect-button-div").style.display = "none";
  document.querySelector("#disconnect-button-div").style.display = "block";
  // TODO
  // document.querySelector("#connected").style.display = "block";
}

function updateUIvalues() {
  const web3 = new Web3(provider);

  var fieldDistance = document.getElementById("ro-input-distance");
  fieldDistance.value = window.flightDistance.toFixed(1) + " km";
  var fieldCarbonToOffset = document.getElementById("ro-input-tco2");
  fieldCarbonToOffset.value = window.carbonToOffset + " TCO2";
  var fieldPaymentQuantity = document.getElementById("ro-input-required-payment-token-amount");

  console.log("connected: ", window.isConnected)
  if (window.isConnected) {
    updatePaymentCosts();
    fieldPaymentQuantity.value = parseFloat(web3.utils.fromWei(window.paymentQuantity)).toFixed(4);
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
  // TODO
  // document.querySelector("#connected").style.display = "none";

  document.querySelector("#connect-button-div").style.display = "block";
  document.querySelector("#disconnect-button-div").style.display = "none";


  // Disable button while UI is loading.
  // fetchAccountData() will take a while as it communicates
  // with Ethereum node via JSON-RPC and loads chain data
  // over an API call.
  document.querySelector("#btn-connect").setAttribute("disabled", "disabled")
  await fetchAccountData(provider);
  document.querySelector("#btn-connect").removeAttribute("disabled")
}

async function updatePaymentCosts() {
  window.paymentCurrency = await document.querySelector("#list-payment-tokens").value.toLowerCase();
  console.log("Payment currency changed: ", window.paymentCurrency);
  console.log("Connected:", window.isConnected);
  if (window.isConnected !== true) {
    console.log("skipping update of payment costs; wallet not connected")
    return;
  }
  const web3 = new Web3(provider);
  switch (window.paymentCurrency) {
    case "matic":
      var approveButton = document.getElementById("btn-approve");
      approveButton.setAttribute("style", "display:none")
      await calculateRequiredMaticPaymentForOffset();
      break;
    case "usdc":
    case "wmatic":
    case "weth":
      var approveButton = document.getElementById("btn-approve");
      approveButton.setAttribute("style", "display:true");
      var fieldPaymentQuantity = document.getElementById("ro-input-required-payment-token-amount");
      fieldPaymentQuantity.value = parseFloat(web3.utils.fromWei(window.paymentQuantity)).toFixed(4);
      await calculateRequiredTokenPaymentForOffset();
      await createErc20Contract();
      break;
    case "nct":
      var approveButton = document.getElementById("btn-approve");
      approveButton.setAttribute("style", "display:true")
      window.paymentQuantity = web3.utils.toWei(window.carbonToOffset, "ether");
      var fieldPaymentQuantity = document.getElementById("ro-input-required-payment-token-amount");
      fieldPaymentQuantity.value = parseFloat(web3.utils.fromWei(window.paymentQuantity)).toFixed(4);
      await createErc20Contract();
      break;
    default:
      console.log("unsupported currency! ", window.paymentCurrency);
      var fieldPaymentQuantity = document.getElementById("ro-input-required-payment-token-amount");
      fieldPaymentQuantity.value = "unsupported token";
  }
}

async function calculateRequiredMaticPaymentForOffset() {
  const web3 = new Web3(provider);
  console.log("test carbon to offset: ", window.carbonToOffset)
  const carbonToOffsetWei = web3.utils.toWei(window.carbonToOffset, "ether");
  window.paymentQuantity = await window.offsetHelper.methods
    .calculateNeededETHAmount(NCTTokenAddress, carbonToOffsetWei)
    .call();
  console.log("Matic: ", web3.utils.fromWei(window.paymentQuantity))
}

async function calculateRequiredTokenPaymentForOffset() {
  const web3 = new Web3(provider);
  const carbonToOffsetWei = web3.utils.toWei(window.carbonToOffset, "ether");
  window.paymentQuantity = await window.offsetHelper.methods
    .calculateNeededTokenAmount(tokenAddresses[window.paymentCurrency], NCTTokenAddress, carbonToOffsetWei)
    .call();
  console.log("Token: ", web3.utils.fromWei(window.paymentQuantity))
}

async function createErc20Contract() {
  let jsonFile = "./ABI/ERC20.json";
  var erc20ABI = await $.getJSON(jsonFile);
  console.log(erc20ABI)
  const web3 = new Web3(provider);
  window.erc20Contract = await new web3.eth.Contract(erc20ABI, tokenAddresses[window.paymentCurrency]);
}

async function approveErc20() {
  const web3 = new Web3(provider);
  console.log("Approving", offsetHelperAddress, "to deposit", web3.utils.fromWei(window.paymentQuantity), window.paymentCurrency, "(", window.paymentQuantity, ")");
  const txReceipt = window.erc20Contract.methods
    .approve(offsetHelperAddress, window.paymentQuantity)
    .send({
      from: selectedAccount
    });
}

async function doAutoOffset() {
  console.log("AutoOffsetting with Payment currency:", window.paymentCurrency);
  console.log("Connected:", window.isConnected);
  if (window.isConnected !== true) {
    console.log("skipping auto offset costs; wallet not connected")
    return;
  }
  switch (window.paymentCurrency) {
    case "matic":
      await doAutoOffsetUsingETH();
      break;
    case "usdc":
    case "wmatic":
    case "weth":
      await doAutoOffsetUsingToken();
      break;
    case "nct":
      await doAutoOffsetUsingPoolToken();
      break;
    default: console.log("unsupported currency! ", window.paymentCurrency);
  }
}
async function doAutoOffsetUsingETH() {
  const web3 = new Web3(provider);
  const accounts = await web3.eth.getAccounts();
  selectedAccount = accounts[0];
  // Update matic value before sending txn to account for any price change
  // (an outdated value can lead to gas estimation error)
  await calculateRequiredMaticPaymentForOffset();
  console.log("Will offset", window.carbonToOffset, "using", web3.utils.fromWei(window.paymentQuantity), window.paymentCurrency.toUpperCase());
  const carbonToOffsetWei = web3.utils.toWei(window.carbonToOffset, "ether");
  const txReceipt = await window.offsetHelper.methods
    .autoOffsetUsingETH(NCTTokenAddress, carbonToOffsetWei)
    .send({
      from: selectedAccount,
      value: window.paymentQuantity,
    });
  console.log("offset done: ", web3.utils.fromWei(window.paymentQuantity));
}

async function doAutoOffsetUsingToken() {
  const web3 = new Web3(provider);
  const accounts = await web3.eth.getAccounts();
  selectedAccount = accounts[0];
  // Update token amount before sending txn to account for any price change
  // (an outdated value can lead to gas estimation error)
  await calculateRequiredTokenPaymentForOffset();
  console.log("Will offset", window.carbonToOffset, "using", web3.utils.fromWei(window.paymentQuantity), window.paymentCurrency.toUpperCase());
  const carbonToOffsetWei = web3.utils.toWei(window.carbonToOffset, "ether");
  const txReceipt = await window.offsetHelper.methods
    .autoOffsetUsingToken(tokenAddresses[window.paymentCurrency], NCTTokenAddress, carbonToOffsetWei)
    .send({
      from: selectedAccount
    });
  console.log("offset done: ", web3.utils.fromWei(window.paymentQuantity));
}

async function doAutoOffsetUsingPoolToken() {
  const web3 = new Web3(provider);
  const accounts = await web3.eth.getAccounts();
  selectedAccount = accounts[0];
  console.log("Will offset", window.carbonToOffset, "using", web3.utils.fromWei(window.paymentQuantity), window.paymentCurrency.toUpperCase());
  const carbonToOffsetWei = web3.utils.toWei(window.carbonToOffset, "ether");
  const txReceipt = await window.offsetHelper.methods
    .autoOffsetUsingPoolToken(NCTTokenAddress, carbonToOffsetWei)
    .send({
      from: selectedAccount
    });
  console.log("Offset done.");
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
 * Connect wallet button pressed.
 */
async function onConnect() {

  console.log("Opening a dialog", web3Modal);
  try {
    provider = await web3Modal.connect();
  } catch (e) {
    console.log("Could not get a wallet connection", e);
    return;
  }
  window.isConnected = true;

  await createContractObject();

  // Subscribe to accounts change
  provider.on("accountsChanged", (accounts) => {
    fetchAccountData();
  });

  // Subscribe to chainId change
  provider.on("chainChanged", (chainId) => {
    fetchAccountData();
  });

  // Subscribe to networkId change
  provider.on("networkChanged", (networkId) => {
    fetchAccountData();
  });

  var el = document.getElementById("btn-offset");
  if (el.addEventListener) el.addEventListener("click", doAutoOffset, false);
  else if (el.attachEvent) el.attachEvent("onclick", doAutoOffset);

  var btnApprove = document.getElementById("btn-approve");
  if (btnApprove.addEventListener) btnApprove.addEventListener("click", approveErc20, false);
  else if (btnApprove.attachEvent) btnApprove.attachEvent("onclick", approveErc20);

  await refreshAccountData();
}

/**
 * Disconnect wallet button pressed.
 */
async function onDisconnect() {

  console.log("Killing the wallet connection", provider);

  // TODO: Which providers have close method?
  if (provider.close) {
    await provider.close();

    // If the cached provider is not cleared,
    // WalletConnect will default to the existing session
    // and does not allow to re-scan the QR code with a new wallet.
    // Depending on your use case you may want or want not his behavir.
    await web3Modal.clearCachedProvider();
    provider = null;
  }

  selectedAccount = null;

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
  calculateCarbonEmission();
}

function increment(e) {
  const btn = e.target.parentNode.parentElement.querySelector(
    'button[data-action="decrement"]'
  );
  const target = btn.nextElementSibling;
  let value = Number(target.value);
  value++;
  target.value = value;
  calculateCarbonEmission();
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
  let startLocation = await findLatLong(startName)

  let destinationName = document.getElementById('destination').value
  let destinationLocation = await findLatLong(destinationName)


  console.log("Locations:", startLocation, " ", destinationLocation)

  if (startLocation && destinationLocation) {
    window.flightDistance = calcGeodesicDistance(startLocation, destinationLocation)
    console.log("Distance: ", window.flightDistance)
    calculateCarbonEmission();
  }
}

/**
 * get carbon emission from distance and other fields
 */
async function calculateCarbonEmission() {
  // Formula follows myclimates estimation calulator
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
      business: 1.23,
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
    CF: 0.26,
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

  let emission = "0";
  if (window.flightDistance < 1500) {  // short distance
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

  window.carbonToOffset = emission.toFixed(3).toString();
  console.log("Carbon Emission: ", emission);
  await updatePaymentCosts();
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
  console.log("manual change:")
  let TCO2 = parseFloat(document.getElementById("ro-input-tco2").value);

  if (TCO2) {
    window.carbonToOffset = TCO2.toFixed(3).toString();
    await updatePaymentCosts();
  }

  console.log("Carbon Emission: ", TCO2);
  updateUIvalues();
}


/**
 * Make autocomplete list for airports
 */
$(function () {
  $(".airports").autocomplete({
    maxShowItems: 10,
    source: airportsList,
    minLength: 2
  });
});



/**
 * Main entry point.
 */
window.addEventListener('load', async () => {
  init();
  document.querySelector("#btn-connect").addEventListener("click", onConnect);
  document.querySelector("#btn-disconnect").addEventListener("click", onDisconnect);
  document.querySelector("#start").addEventListener("change", calculateFlightDistance);
  document.querySelector("#destination").addEventListener("change", calculateFlightDistance);
  document.querySelector("#list-payment-tokens").addEventListener("change", updatePaymentCosts);
  document.querySelector("#roundtrip").addEventListener("click", calculateCarbonEmission);
  document.querySelector('#flightclass').addEventListener("change", calculateCarbonEmission);
  document.querySelector('#ro-input-tco2').addEventListener("change", handleManuallyEnteredTCO2);
});
