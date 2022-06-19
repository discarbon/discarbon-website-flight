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


// Other constants

let carbonToOffset = "0.3";
let maticToSend = "";

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

  var start = new Location(35.6544, 139.74477);
  var destination = new Location(21.4225, 39.8261);
  console.log("Start: ", start, "Destination: ", destination);

  var distance = calcGeodesicDistance(start, destination);
  console.log("Distance: ", distance);


  // window.airports = loadAirportJSON();

  // findLatLong("Altenburg-Nobitz Airport Altenburg DE AOC");
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
  document.querySelector("#network-name").textContent = chainData.name;

  // Get list of accounts of the connected wallet
  const accounts = await web3.eth.getAccounts();

  // MetaMask does not give you all accounts, only the selected account
  console.log("Got accounts", accounts);
  selectedAccount = accounts[0];

  document.querySelector("#selected-account").textContent = selectedAccount.slice(0, 8) + "..." + selectedAccount.slice(-6);

  // Get a handle
  const template = document.querySelector("#template-balance");
  const accountContainer = document.querySelector("#accounts");

  // Purge UI elements any previously loaded accounts
  accountContainer.innerHTML = '';

  // Go through all accounts and get their ETH balance
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

  // Because rendering account does its own RPC communication
  // with Ethereum node, we do not want to display any results
  // until data for all accounts is loaded
  await Promise.all(rowResolvers);


  // Display matic and carbon to offset
  const carbonToOffsetWei = web3.utils.toWei(carbonToOffset, "ether");
  // window.maticToSend = await window.offsetHelper.methods
  // .howMuchETHShouldISendToSwap(NCTTokenAddress, carbonToOffsetWei)
  window.maticToSend = await window.offsetHelper.methods
    .calculateNeededETHAmount(NCTTokenAddress, carbonToOffsetWei)
    .call();
  console.log("Matic: ", web3.utils.fromWei(window.maticToSend))

  const offSetTable = document.querySelector("#offSetTable");
  offSetTable.innerHTML = '';
  const clone = template.content.cloneNode(true);
  clone.querySelector(".address").textContent = carbonToOffset;
  clone.querySelector(".balance").textContent = parseFloat(web3.utils.fromWei(window.maticToSend)).toFixed(4);
  offSetTable.appendChild(clone);

  // Display fully loaded UI for wallet data
  document.querySelector("#connect-button-div").style.display = "none";
  document.querySelector("#disconnect-button-div").style.display = "block";
  document.querySelector("#connected").style.display = "block";


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
  document.querySelector("#connected").style.display = "none";
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

async function doSimpleOffset() {
  const web3 = new Web3(provider);
  const accounts = await web3.eth.getAccounts();

  // MetaMask does not give you all accounts, only the selected account
  console.log("Got accounts", accounts);
  selectedAccount = accounts[0];
  console.log(
    "Matic: ",
    web3.utils.fromWei(window.maticToSend),
    ", ",
    window.maticToSend
  );
  const carbonToOffsetWei = web3.utils.toWei(carbonToOffset, "ether");
  const txReceipt = await window.offsetHelper.methods
    .autoOffsetUsingETH(NCTTokenAddress, carbonToOffsetWei)
    .send({
      from: selectedAccount,
      value: window.maticToSend,
    });
  console.log("offset done: ", web3.utils.fromWei(window.maticToSend));
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

  let deltaLambda = destination.longitude - start.longitude;

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
  let deltaSigma = Math.atan(Math.sqrt(A + B) / C);
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
  if (el.addEventListener) el.addEventListener("click", doSimpleOffset, false);
  else if (el.attachEvent) el.attachEvent("onclick", doSimpleOffset);

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
  document.querySelector("#connected").style.display = "none";
}

function decrement(e) {
  const btn = e.target.parentNode.parentElement.querySelector(
    'button[data-action="decrement"]'
  );
  const target = btn.nextElementSibling;
  let value = Number(target.value);
  value--;
  target.value = value;
}

function increment(e) {
  const btn = e.target.parentNode.parentElement.querySelector(
    'button[data-action="decrement"]'
  );
  const target = btn.nextElementSibling;
  let value = Number(target.value);
  value++;
  target.value = value;
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

  console.log("Location:", result)
  let location = new Location(result[1], result[2]);
  return location
}

async function calculateFlightDistance() {

  let startName = document.getElementById('start').value
  let startLocation = await findLatLong(startName)

  let destinationName = document.getElementById('destination').value
  let destinationLocation = await findLatLong(destinationName)


  console.log("Locations:", startLocation, " ", destinationLocation)

  if (startLocation && destinationLocation){
    console.log("in if statement")
    let distance = calcGeodesicDistance(startLocation, destinationLocation)
    console.log("Distance: ", distance)
  }

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

});
