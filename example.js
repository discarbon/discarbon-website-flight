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

const offsetHelperAddress = "0x79E63048B355F4FBa192c5b28687B852a5521b31";
const NCTTokenAddress = "0xD838290e877E0188a4A44700463419ED96c16107";

let offsetHelper;  // contract object of the offsethelper


// Other constants

let carbonToOffset = "0.3";
let maticToSend = "";


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


}

async function createContractObject() {
  // Load ABI

  let jsonFile = "./ABI/OffsetHelper2.json";
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

  document.querySelector("#selected-account").textContent = selectedAccount.slice(0,8)+"..."+selectedAccount.slice(-6);

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
    clone.querySelector(".address").textContent = address.slice(0,8)+"..."+address.slice(-6);
    clone.querySelector(".balance").textContent = humanFriendlyBalance;
    accountContainer.appendChild(clone);
  });

  // Because rendering account does its own RPC communication
  // with Ethereum node, we do not want to display any results
  // until data for all accounts is loaded
  await Promise.all(rowResolvers);


  // Display matic and carbon to offset
  const carbonToOffsetWei = web3.utils.toWei(carbonToOffset, "ether");
  window.maticToSend = await window.offsetHelper.methods
  .howMuchETHShouldISendToSwap(NCTTokenAddress, carbonToOffsetWei)
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
  return angle*Math.PI/180;
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
  let deltaSigma = Math.atan(Math.sqrt(A+B)/C);
  let distance = earthRadius*deltaSigma;
  return distance;
}

/**
 * Connect wallet button pressed.
 */
async function onConnect() {

  console.log("Opening a dialog", web3Modal);
  try {
    provider = await web3Modal.connect();
  } catch(e) {
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

  await refreshAccountData();
}

/**
 * Disconnect wallet button pressed.
 */
async function onDisconnect() {

  console.log("Killing the wallet connection", provider);

  // TODO: Which providers have close method?
  if(provider.close) {
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

$(function () {

  const airports = [
    {
      name: "Honiara International Airport",
      latitude_deg: "-9.428",
      longitude_deg: "160.054993",
      elevation_ft: 28,
      continent: "OC",
      iso_country: "SB",
      iso_region: "SB-GU",
      municipality: "Honiara",
      iata_code: "HIR"
    },
    {
      name: "Momote Airport",
      latitude_deg: "-2.06189",
      longitude_deg: "147.423996",
      elevation_ft: 12,
      continent: "OC",
      iso_country: "PG",
      iso_region: "PG-MRL",
      municipality: "Manus Island",
      iata_code: "MAS"
    },
    {
      name: "Port Moresby Jacksons International Airport",
      latitude_deg: "-9.44338035583496",
      longitude_deg: "147.220001220703",
      elevation_ft: 146,
      continent: "OC",
      iso_country: "PG",
      iso_region: "PG-NCD",
      municipality: "Port Moresby",
      iata_code: "POM"
    },
    {
      name: "Keflavik International Airport",
      latitude_deg: "63.985001",
      longitude_deg: "-22.6056",
      elevation_ft: 171,
      continent: "EU",
      iso_country: "IS",
      iso_region: "IS-2",
      municipality: "Reykjavík",
      iata_code: "KEF"
    },
    {
      name: "Edmonton International Airport",
      latitude_deg: "53.3097000122",
      longitude_deg: "-113.580001831",
      elevation_ft: 2373,
      continent: "NA",
      iso_country: "CA",
      iso_region: "CA-AB",
      municipality: "Edmonton",
      iata_code: "YEG"
    },
    {
      name: "Halifax / Stanfield International Airport",
      latitude_deg: "44.8807983398",
      longitude_deg: "-63.5085983276",
      elevation_ft: 477,
      continent: "NA",
      iso_country: "CA",
      iso_region: "CA-NS",
      municipality: "Halifax",
      iata_code: "YHZ"
    },
    {
      name: "Ottawa Macdonald-Cartier International Airport",
      latitude_deg: "45.3224983215332",
      longitude_deg: "-75.6691970825195",
      elevation_ft: 374,
      continent: "NA",
      iso_country: "CA",
      iso_region: "CA-ON",
      municipality: "Ottawa",
      iata_code: "YOW"
    },
    {
      name: "Quebec Jean Lesage International Airport",
      latitude_deg: "46.7911",
      longitude_deg: "-71.393303",
      elevation_ft: 244,
      continent: "NA",
      iso_country: "CA",
      iso_region: "CA-QC",
      municipality: "Quebec",
      iata_code: "YQB"
    },
    {
      name: "Montreal / Pierre Elliott Trudeau International Airport",
      latitude_deg: "45.4706001282",
      longitude_deg: "-73.7407989502",
      elevation_ft: 118,
      continent: "NA",
      iso_country: "CA",
      iso_region: "CA-QC",
      municipality: "Montréal",
      iata_code: "YUL"
    },
    {
      name: "Vancouver International Airport",
      latitude_deg: "49.193901062",
      longitude_deg: "-123.183998108",
      elevation_ft: 14,
      continent: "NA",
      iso_country: "CA",
      iso_region: "CA-BC",
      municipality: "Vancouver",
      iata_code: "YVR"
    },
    {
      name: "Winnipeg / James Armstrong Richardson International Airport",
      latitude_deg: "49.9099998474",
      longitude_deg: "-97.2398986816",
      elevation_ft: 783,
      continent: "NA",
      iso_country: "CA",
      iso_region: "CA-MB",
      municipality: "Winnipeg",
      iata_code: "YWG"
    },
    {
      name: "Calgary International Airport",
      latitude_deg: "51.113899231",
      longitude_deg: "-114.019996643",
      elevation_ft: 3557,
      continent: "NA",
      iso_country: "CA",
      iso_region: "CA-AB",
      municipality: "Calgary",
      iata_code: "YYC"
    },
    {
      name: "St. John's International Airport",
      latitude_deg: "47.618598938",
      longitude_deg: "-52.7518997192",
      elevation_ft: 461,
      continent: "NA",
      iso_country: "CA",
      iso_region: "CA-NL",
      municipality: "St. John's",
      iata_code: "YYT"
    },
    {
      name: "Lester B. Pearson International Airport",
      latitude_deg: "43.6772003174",
      longitude_deg: "-79.6305999756",
      elevation_ft: 569,
      continent: "NA",
      iso_country: "CA",
      iso_region: "CA-ON",
      municipality: "Toronto",
      iata_code: "YYZ"
    },
    {
      name: "Houari Boumediene Airport",
      latitude_deg: "36.691002",
      longitude_deg: "3.21541",
      elevation_ft: 82,
      continent: "AF",
      iso_country: "DZ",
      iso_region: "DZ-16",
      municipality: "Algiers",
      iata_code: "ALG"
    },
    {
      name: "Kotoka International Airport",
      latitude_deg: "5.60518980026245",
      longitude_deg: "-0.166786000132561",
      elevation_ft: 205,
      continent: "AF",
      iso_country: "GH",
      iso_region: "GH-AA",
      municipality: "Accra",
      iata_code: "ACC"
    },
    {
      name: "Nnamdi Azikiwe International Airport",
      latitude_deg: "9.00679016113281",
      longitude_deg: "7.26316976547241",
      elevation_ft: 1123,
      continent: "AF",
      iso_country: "NG",
      iso_region: "NG-FC",
      municipality: "Abuja",
      iata_code: "ABV"
    },
    {
      name: "Murtala Muhammed International Airport",
      latitude_deg: "6.57737016677856",
      longitude_deg: "3.32116007804871",
      elevation_ft: 135,
      continent: "AF",
      iso_country: "NG",
      iso_region: "NG-LA",
      municipality: "Lagos",
      iata_code: "LOS"
    },
    {
      name: "Diori Hamani International Airport",
      latitude_deg: "13.4815",
      longitude_deg: "2.18361",
      elevation_ft: 732,
      continent: "AF",
      iso_country: "NE",
      iso_region: "NE-8",
      municipality: "Niamey",
      iata_code: "NIM"
    },
    {
      name: "Tunis Carthage International Airport",
      latitude_deg: "36.851001739502",
      longitude_deg: "10.2271995544434",
      elevation_ft: 22,
      continent: "AF",
      iso_country: "TN",
      iso_region: "TN-11",
      municipality: "Tunis",
      iata_code: "TUN"
    },
    {
      name: "Brussels Airport",
      latitude_deg: "50.9014015198",
      longitude_deg: "4.48443984985",
      elevation_ft: 184,
      continent: "EU",
      iso_country: "BE",
      iso_region: "BE-BRU",
      municipality: "Brussels",
      iata_code: "BRU"
    },
    {
      name: "Berlin Brandenburg Airport",
      latitude_deg: "52.362247",
      longitude_deg: "13.500672",
      elevation_ft: 157,
      continent: "EU",
      iso_country: "DE",
      iso_region: "DE-BR",
      municipality: "Berlin",
      iata_code: "BER"
    },
    {
      name: "Frankfurt am Main Airport",
      latitude_deg: "50.036249",
      longitude_deg: "8.559294",
      elevation_ft: 364,
      continent: "EU",
      iso_country: "DE",
      iso_region: "DE-HE",
      municipality: "Frankfurt am Main",
      iata_code: "FRA"
    },
    {
      name: "Hamburg Helmut Schmidt Airport",
      latitude_deg: "53.630402",
      longitude_deg: "9.98823",
      elevation_ft: 53,
      continent: "EU",
      iso_country: "DE",
      iso_region: "DE-HH",
      municipality: "Hamburg",
      iata_code: "HAM"
    },
    {
      name: "Cologne Bonn Airport",
      latitude_deg: "50.8658981323",
      longitude_deg: "7.1427397728",
      elevation_ft: 302,
      continent: "EU",
      iso_country: "DE",
      iso_region: "DE-NW",
      municipality: "Cologne",
      iata_code: "CGN"
    },
    {
      name: "Düsseldorf Airport",
      latitude_deg: "51.289501",
      longitude_deg: "6.76678",
      elevation_ft: 147,
      continent: "EU",
      iso_country: "DE",
      iso_region: "DE-NW",
      municipality: "Düsseldorf",
      iata_code: "DUS"
    },
    {
      name: "Munich Airport",
      latitude_deg: "48.353802",
      longitude_deg: "11.7861",
      elevation_ft: 1487,
      continent: "EU",
      iso_country: "DE",
      iso_region: "DE-BY",
      municipality: "Munich",
      iata_code: "MUC"
    },
    {
      name: "Nuremberg Airport",
      latitude_deg: "49.498699",
      longitude_deg: "11.078056",
      elevation_ft: 1046,
      continent: "EU",
      iso_country: "DE",
      iso_region: "DE-BY",
      municipality: "Nuremberg",
      iata_code: "NUE"
    },
    {
      name: "Leipzig/Halle Airport",
      latitude_deg: "51.423889",
      longitude_deg: "12.236389",
      elevation_ft: 465,
      continent: "EU",
      iso_country: "DE",
      iso_region: "DE-SN",
      municipality: "Leipzig",
      iata_code: "LEJ"
    },
    {
      name: "Stuttgart Airport",
      latitude_deg: "48.6898994446",
      longitude_deg: "9.22196006775",
      elevation_ft: 1276,
      continent: "EU",
      iso_country: "DE",
      iso_region: "DE-BW",
      municipality: "Stuttgart",
      iata_code: "STR"
    },
    {
      name: "Hannover Airport",
      latitude_deg: "52.461101532",
      longitude_deg: "9.68507957458",
      elevation_ft: 183,
      continent: "EU",
      iso_country: "DE",
      iso_region: "DE-NI",
      municipality: "Hannover",
      iata_code: "HAJ"
    },
    {
      name: "Lennart Meri Tallinn Airport",
      latitude_deg: "59.4132995605",
      longitude_deg: "24.8327999115",
      elevation_ft: 131,
      continent: "EU",
      iso_country: "EE",
      iso_region: "EE-37",
      municipality: "Tallinn",
      iata_code: "TLL"
    },
    {
      name: "Helsinki Vantaa Airport",
      latitude_deg: "60.3172",
      longitude_deg: "24.963301",
      elevation_ft: 179,
      continent: "EU",
      iso_country: "FI",
      iso_region: "FI-18",
      municipality: "Helsinki",
      iata_code: "HEL"
    },
    {
      name: "Belfast International Airport",
      latitude_deg: "54.6575012207",
      longitude_deg: "-6.21582984924",
      elevation_ft: 268,
      continent: "EU",
      iso_country: "GB",
      iso_region: "GB-NIR",
      municipality: "Belfast",
      iata_code: "BFS"
    },
    {
      name: "Birmingham International Airport",
      latitude_deg: "52.4538993835",
      longitude_deg: "-1.74802994728",
      elevation_ft: 327,
      continent: "EU",
      iso_country: "GB",
      iso_region: "GB-ENG",
      municipality: "Birmingham",
      iata_code: "BHX"
    },
    {
      name: "Manchester Airport",
      latitude_deg: "53.349375",
      longitude_deg: "-2.279521",
      elevation_ft: 257,
      continent: "EU",
      iso_country: "GB",
      iso_region: "GB-ENG",
      municipality: "Manchester",
      iata_code: "MAN"
    },
    {
      name: "London Luton Airport",
      latitude_deg: "51.874698638916",
      longitude_deg: "-0.368333011865616",
      elevation_ft: 526,
      continent: "EU",
      iso_country: "GB",
      iso_region: "GB-ENG",
      municipality: "London",
      iata_code: "LTN"
    },
    {
      name: "London Gatwick Airport",
      latitude_deg: "51.148102",
      longitude_deg: "-0.190278",
      elevation_ft: 202,
      continent: "EU",
      iso_country: "GB",
      iso_region: "GB-ENG",
      municipality: "London",
      iata_code: "LGW"
    },
    {
      name: "London Heathrow Airport",
      latitude_deg: "51.4706",
      longitude_deg: "-0.461941",
      elevation_ft: 83,
      continent: "EU",
      iso_country: "GB",
      iso_region: "GB-ENG",
      municipality: "London",
      iata_code: "LHR"
    },
    {
      name: "Glasgow International Airport",
      latitude_deg: "55.871899",
      longitude_deg: "-4.43306",
      elevation_ft: 26,
      continent: "EU",
      iso_country: "GB",
      iso_region: "GB-SCT",
      municipality: "Paisley, Renfrewshire",
      iata_code: "GLA"
    },
    {
      name: "Edinburgh Airport",
      latitude_deg: "55.950145",
      longitude_deg: "-3.372288",
      elevation_ft: 135,
      continent: "EU",
      iso_country: "GB",
      iso_region: "GB-SCT",
      municipality: "Edinburgh",
      iata_code: "EDI"
    },
    {
      name: "London Stansted Airport",
      latitude_deg: "51.8849983215",
      longitude_deg: "0.234999999404",
      elevation_ft: 348,
      continent: "EU",
      iso_country: "GB",
      iso_region: "GB-ENG",
      municipality: "London",
      iata_code: "STN"
    },
    {
      name: "Amsterdam Airport Schiphol",
      latitude_deg: "52.308601",
      longitude_deg: "4.76389",
      elevation_ft: -11,
      continent: "EU",
      iso_country: "NL",
      iso_region: "NL-NH",
      municipality: "Amsterdam",
      iata_code: "AMS"
    },
    {
      name: "Eindhoven Airport",
      latitude_deg: "51.4500999451",
      longitude_deg: "5.37452983856",
      elevation_ft: 74,
      continent: "EU",
      iso_country: "NL",
      iso_region: "NL-NB",
      municipality: "Eindhoven",
      iata_code: "EIN"
    },
    {
      name: "Dublin Airport",
      latitude_deg: "53.421299",
      longitude_deg: "-6.27007",
      elevation_ft: 242,
      continent: "EU",
      iso_country: "IE",
      iso_region: "IE-D",
      municipality: "Dublin",
      iata_code: "DUB"
    },
    {
      name: "Shannon Airport",
      latitude_deg: "52.702",
      longitude_deg: "-8.92482",
      elevation_ft: 46,
      continent: "EU",
      iso_country: "IE",
      iso_region: "IE-CE",
      municipality: "Shannon",
      iata_code: "SNN"
    },
    {
      name: "Billund Airport",
      latitude_deg: "55.7402992249",
      longitude_deg: "9.15178012848",
      elevation_ft: 247,
      continent: "EU",
      iso_country: "DK",
      iso_region: "DK-83",
      municipality: "Billund",
      iata_code: "BLL"
    },
    {
      name: "Copenhagen Kastrup Airport",
      latitude_deg: "55.617900848389",
      longitude_deg: "12.656000137329",
      elevation_ft: 17,
      continent: "EU",
      iso_country: "DK",
      iso_region: "DK-84",
      municipality: "Copenhagen",
      iata_code: "CPH"
    },
    {
      name: "Luxembourg-Findel International Airport",
      latitude_deg: "49.6233333",
      longitude_deg: "6.2044444",
      elevation_ft: 1234,
      continent: "EU",
      iso_country: "LU",
      iso_region: "LU-L",
      municipality: "Luxembourg",
      iata_code: "LUX"
    },
    {
      name: "Bergen Airport, Flesland",
      latitude_deg: "60.2934",
      longitude_deg: "5.21814",
      elevation_ft: 170,
      continent: "EU",
      iso_country: "NO",
      iso_region: "NO-46",
      municipality: "Bergen",
      iata_code: "BGO"
    },
    {
      name: "Oslo Airport, Gardermoen",
      latitude_deg: "60.193901",
      longitude_deg: "11.1004",
      elevation_ft: 681,
      continent: "EU",
      iso_country: "NO",
      iso_region: "NO-30",
      municipality: "Oslo",
      iata_code: "OSL"
    },
    {
      name: "Tromsø Airport, Langnes",
      latitude_deg: "69.683296",
      longitude_deg: "18.9189",
      elevation_ft: 31,
      continent: "EU",
      iso_country: "NO",
      iso_region: "NO-54",
      municipality: "Tromsø",
      iata_code: "TOS"
    },
    {
      name: "Trondheim Airport, Værnes",
      latitude_deg: "63.457802",
      longitude_deg: "10.924",
      elevation_ft: 56,
      continent: "EU",
      iso_country: "NO",
      iso_region: "NO-50",
      municipality: "Trondheim",
      iata_code: "TRD"
    },
    {
      name: "Stavanger Airport, Sola",
      latitude_deg: "58.876701",
      longitude_deg: "5.63778",
      elevation_ft: 29,
      continent: "EU",
      iso_country: "NO",
      iso_region: "NO-11",
      municipality: "Stavanger",
      iata_code: "SVG"
    },
    {
      name: "Gdańsk Lech Wałęsa Airport",
      latitude_deg: "54.3776016235352",
      longitude_deg: "18.4661998748779",
      elevation_ft: 489,
      continent: "EU",
      iso_country: "PL",
      iso_region: "PL-PM",
      municipality: "Gdańsk",
      iata_code: "GDN"
    },
    {
      name: "Kraków John Paul II International Airport",
      latitude_deg: "50.077702",
      longitude_deg: "19.7848",
      elevation_ft: 791,
      continent: "EU",
      iso_country: "PL",
      iso_region: "PL-MA",
      municipality: "Kraków",
      iata_code: "KRK"
    },
    {
      name: "Warsaw Chopin Airport",
      latitude_deg: "52.1656990051",
      longitude_deg: "20.9671001434",
      elevation_ft: 362,
      continent: "EU",
      iso_country: "PL",
      iso_region: "PL-MZ",
      municipality: "Warsaw",
      iata_code: "WAW"
    },
    {
      name: "Gothenburg-Landvetter Airport",
      latitude_deg: "57.662799835205",
      longitude_deg: "12.279800415039",
      elevation_ft: 506,
      continent: "EU",
      iso_country: "SE",
      iso_region: "SE-Q",
      municipality: "Gothenburg",
      iata_code: "GOT"
    },
    {
      name: "Stockholm-Arlanda Airport",
      latitude_deg: "59.651901245117",
      longitude_deg: "17.918600082397",
      elevation_ft: 137,
      continent: "EU",
      iso_country: "SE",
      iso_region: "SE-AB",
      municipality: "Stockholm",
      iata_code: "ARN"
    },
    {
      name: "Riga International Airport",
      latitude_deg: "56.923599",
      longitude_deg: "23.9711",
      elevation_ft: 36,
      continent: "EU",
      iso_country: "LV",
      iso_region: "LV-062",
      municipality: "Riga",
      iata_code: "RIX"
    },
    {
      name: "Vilnius International Airport",
      latitude_deg: "54.634102",
      longitude_deg: "25.285801",
      elevation_ft: 648,
      continent: "EU",
      iso_country: "LT",
      iso_region: "LT-VL",
      municipality: "Vilnius",
      iata_code: "VNO"
    },
    {
      name: "Cape Town International Airport",
      latitude_deg: "-33.9648017883",
      longitude_deg: "18.6016998291",
      elevation_ft: 151,
      continent: "AF",
      iso_country: "ZA",
      iso_region: "ZA-WC",
      municipality: "Cape Town",
      iata_code: "CPT"
    },
    {
      name: "King Shaka International Airport",
      latitude_deg: "-29.6144444444",
      longitude_deg: "31.1197222222",
      elevation_ft: 295,
      continent: "AF",
      iso_country: "ZA",
      iso_region: "ZA-NL",
      municipality: "Durban",
      iata_code: "DUR"
    },
    {
      name: "OR Tambo International Airport",
      latitude_deg: "-26.1392",
      longitude_deg: "28.246",
      elevation_ft: 5558,
      continent: "AF",
      iso_country: "ZA",
      iso_region: "ZA-GT",
      municipality: "Johannesburg",
      iata_code: "JNB"
    },
    {
      name: "Sir Seretse Khama International Airport",
      latitude_deg: "-24.555201",
      longitude_deg: "25.9182",
      elevation_ft: 3299,
      continent: "AF",
      iso_country: "BW",
      iso_region: "BW-GA",
      municipality: "Gaborone",
      iata_code: "GBE"
    },
    {
      name: "King Mswati III International Airport",
      latitude_deg: "-26.358611",
      longitude_deg: "31.716944",
      elevation_ft: 1092,
      continent: "AF",
      iso_country: "SZ",
      iso_region: "SZ-LU",
      municipality: "Mpaka",
      iata_code: "SHO"
    },
    {
      name: "Sir Seewoosagur Ramgoolam International Airport",
      latitude_deg: "-20.430201",
      longitude_deg: "57.683601",
      elevation_ft: 186,
      continent: "AF",
      iso_country: "MU",
      iso_region: "MU-GP",
      municipality: "Plaine Magnein",
      iata_code: "MRU"
    },
    {
      name: "Kenneth Kaunda International Airport",
      latitude_deg: "-15.330833",
      longitude_deg: "28.452722",
      elevation_ft: 3779,
      continent: "AF",
      iso_country: "ZM",
      iso_region: "ZM-09",
      municipality: "Lusaka",
      iata_code: "LUN"
    },
    {
      name: "Roland Garros Airport",
      latitude_deg: "-20.8871",
      longitude_deg: "55.5103",
      elevation_ft: 66,
      continent: "AF",
      iso_country: "RE",
      iso_region: "RE-U-A",
      municipality: "St Denis",
      iata_code: "RUN"
    },
    {
      name: "Ivato Airport",
      latitude_deg: "-18.7969",
      longitude_deg: "47.478802",
      elevation_ft: 4198,
      continent: "AF",
      iso_country: "MG",
      iso_region: "MG-T",
      municipality: "Antananarivo",
      iata_code: "TNR"
    },
    {
      name: "Quatro de Fevereiro International Airport",
      latitude_deg: "-8.85837",
      longitude_deg: "13.2312",
      elevation_ft: 243,
      continent: "AF",
      iso_country: "AO",
      iso_region: "AO-LUA",
      municipality: "Luanda",
      iata_code: "LAD"
    },
    {
      name: "Maputo Airport",
      latitude_deg: "-25.920799",
      longitude_deg: "32.572601",
      elevation_ft: 145,
      continent: "AF",
      iso_country: "MZ",
      iso_region: "MZ-MPM",
      municipality: "Maputo",
      iata_code: "MPM"
    },
    {
      name: "Seychelles International Airport",
      latitude_deg: "-4.67434",
      longitude_deg: "55.521801",
      elevation_ft: 10,
      continent: "AF",
      iso_country: "SC",
      iso_region: "SC-20",
      municipality: "Mahe Island",
      iata_code: "SEZ"
    },
    {
      name: "N'Djamena International Airport",
      latitude_deg: "12.1337",
      longitude_deg: "15.034",
      elevation_ft: 968,
      continent: "AF",
      iso_country: "TD",
      iso_region: "TD-CB",
      municipality: "N'Djamena",
      iata_code: "NDJ"
    },
    {
      name: "Robert Gabriel Mugabe International Airport",
      latitude_deg: "-17.931801",
      longitude_deg: "31.0928",
      elevation_ft: 4887,
      continent: "AF",
      iso_country: "ZW",
      iso_region: "ZW-HA",
      municipality: "Harare",
      iata_code: "HRE"
    },
    {
      name: "Hosea Kutako International Airport",
      latitude_deg: "-22.4799",
      longitude_deg: "17.4709",
      elevation_ft: 5640,
      continent: "AF",
      iso_country: "NA",
      iso_region: "NA-KH",
      municipality: "Windhoek",
      iata_code: "WDH"
    },
    {
      name: "Ndjili International Airport",
      latitude_deg: "-4.38575",
      longitude_deg: "15.4446",
      elevation_ft: 1027,
      continent: "AF",
      iso_country: "CD",
      iso_region: "CD-KN",
      municipality: "Kinshasa",
      iata_code: "FIH"
    },
    {
      name: "Modibo Keita International Airport",
      latitude_deg: "12.5335",
      longitude_deg: "-7.94994",
      elevation_ft: 1247,
      continent: "AF",
      iso_country: "ML",
      iso_region: "ML-2",
      municipality: "Bamako",
      iata_code: "BKO"
    },
    {
      name: "Banjul International Airport",
      latitude_deg: "13.338",
      longitude_deg: "-16.652201",
      elevation_ft: 95,
      continent: "AF",
      iso_country: "GM",
      iso_region: "GM-W",
      municipality: "Banjul",
      iata_code: "BJL"
    },
    {
      name: "Fuerteventura Airport",
      latitude_deg: "28.4527",
      longitude_deg: "-13.8638",
      elevation_ft: 85,
      continent: "EU",
      iso_country: "ES",
      iso_region: "ES-CN",
      municipality: "Fuerteventura Island",
      iata_code: "FUE"
    },
    {
      name: "Gran Canaria Airport",
      latitude_deg: "27.9319",
      longitude_deg: "-15.3866",
      elevation_ft: 78,
      continent: "EU",
      iso_country: "ES",
      iso_region: "ES-CN",
      municipality: "Gran Canaria Island",
      iata_code: "LPA"
    },
    {
      name: "César Manrique-Lanzarote Airport",
      latitude_deg: "28.945499",
      longitude_deg: "-13.6052",
      elevation_ft: 46,
      continent: "EU",
      iso_country: "ES",
      iso_region: "ES-CN",
      municipality: "Lanzarote Island",
      iata_code: "ACE"
    },
    {
      name: "Tenerife Sur Airport",
      latitude_deg: "28.0445",
      longitude_deg: "-16.5725",
      elevation_ft: 209,
      continent: "EU",
      iso_country: "ES",
      iso_region: "ES-CN",
      municipality: "Tenerife",
      iata_code: "TFS"
    },
    {
      name: "Lungi International Airport",
      latitude_deg: "8.61644",
      longitude_deg: "-13.1955",
      elevation_ft: 84,
      continent: "AF",
      iso_country: "SL",
      iso_region: "SL-N",
      municipality: "Freetown (Lungi-Town)",
      iata_code: "FNA"
    },
    {
      name: "Roberts International Airport",
      latitude_deg: "6.23379",
      longitude_deg: "-10.3623",
      elevation_ft: 31,
      continent: "AF",
      iso_country: "LR",
      iso_region: "LR-MG",
      municipality: "Monrovia",
      iata_code: "ROB"
    },
    {
      name: "Mohammed V International Airport",
      latitude_deg: "33.3675003051758",
      longitude_deg: "-7.58997011184692",
      elevation_ft: 656,
      continent: "AF",
      iso_country: "MA",
      iso_region: "MA-CAS",
      municipality: "Casablanca",
      iata_code: "CMN"
    },
    {
      name: "Blaise Diagne International Airport",
      latitude_deg: "14.67",
      longitude_deg: "-17.073333",
      elevation_ft: 290,
      continent: "AF",
      iso_country: "SN",
      iso_region: "SN-DK",
      municipality: "Dakar",
      iata_code: "DSS"
    },
    {
      name: "Nouakchott–Oumtounsy International Airport",
      latitude_deg: "18.31",
      longitude_deg: "-15.9697222",
      elevation_ft: 9,
      continent: "AF",
      iso_country: "MR",
      iso_region: "MR-NKC",
      municipality: "Nouakchott",
      iata_code: "NKC"
    },
    {
      name: "Amílcar Cabral International Airport",
      latitude_deg: "16.7414",
      longitude_deg: "-22.9494",
      elevation_ft: 177,
      continent: "AF",
      iso_country: "CV",
      iso_region: "CV-B",
      municipality: "Espargos",
      iata_code: "SID"
    },
    {
      name: "Addis Ababa Bole International Airport",
      latitude_deg: "8.97789",
      longitude_deg: "38.799301",
      elevation_ft: 7630,
      continent: "AF",
      iso_country: "ET",
      iso_region: "ET-AA",
      municipality: "Addis Ababa",
      iata_code: "ADD"
    },
    {
      name: "Djibouti-Ambouli Airport",
      latitude_deg: "11.5473",
      longitude_deg: "43.1595",
      elevation_ft: 49,
      continent: "AF",
      iso_country: "DJ",
      iso_region: "DJ-DJ",
      municipality: "Djibouti City",
      iata_code: "JIB"
    },
    {
      name: "Cairo International Airport",
      latitude_deg: "30.1219005584717",
      longitude_deg: "31.4055995941162",
      elevation_ft: 382,
      continent: "AF",
      iso_country: "EG",
      iso_region: "EG-C",
      municipality: "Cairo",
      iata_code: "CAI"
    },
    {
      name: "Hurghada International Airport",
      latitude_deg: "27.180325",
      longitude_deg: "33.807292",
      elevation_ft: 32,
      continent: "AF",
      iso_country: "EG",
      iso_region: "EG-BA",
      municipality: "Hurghada",
      iata_code: "HRG"
    },
    {
      name: "Sharm El Sheikh International Airport",
      latitude_deg: "27.977301",
      longitude_deg: "34.395",
      elevation_ft: 143,
      continent: "AS",
      iso_country: "EG",
      iso_region: "EG-JS",
      municipality: "Sharm el-Sheikh",
      iata_code: "SSH"
    },
    {
      name: "Juba International Airport",
      latitude_deg: "4.87201",
      longitude_deg: "31.601101",
      elevation_ft: 1513,
      continent: "AF",
      iso_country: "SS",
      iso_region: "SS-17",
      municipality: "Juba",
      iata_code: "JUB"
    },
    {
      name: "Jomo Kenyatta International Airport",
      latitude_deg: "-1.31923997402",
      longitude_deg: "36.9277992249",
      elevation_ft: 5330,
      continent: "AF",
      iso_country: "KE",
      iso_region: "KE-110",
      municipality: "Nairobi",
      iata_code: "NBO"
    },
    {
      name: "Moi International Airport",
      latitude_deg: "-4.03483",
      longitude_deg: "39.5942",
      elevation_ft: 200,
      continent: "AF",
      iso_country: "KE",
      iso_region: "KE-300",
      municipality: "Mombasa",
      iata_code: "MBA"
    },
    {
      name: "Tripoli International Airport",
      latitude_deg: "32.663502",
      longitude_deg: "13.159",
      elevation_ft: 263,
      continent: "AF",
      iso_country: "LY",
      iso_region: "LY-TB",
      municipality: "Tripoli",
      iata_code: "TIP"
    },
    {
      name: "Kigali International Airport",
      latitude_deg: "-1.96863",
      longitude_deg: "30.1395",
      elevation_ft: 4859,
      continent: "AF",
      iso_country: "RW",
      iso_region: "RW-01",
      municipality: "Kigali",
      iata_code: "KGL"
    },
    {
      name: "Khartoum International Airport",
      latitude_deg: "15.5895",
      longitude_deg: "32.5532",
      elevation_ft: 1265,
      continent: "AF",
      iso_country: "SD",
      iso_region: "SD-03",
      municipality: "Khartoum",
      iata_code: "KRT"
    },
    {
      name: "Julius Nyerere International Airport",
      latitude_deg: "-6.87811",
      longitude_deg: "39.202599",
      elevation_ft: 182,
      continent: "AF",
      iso_country: "TZ",
      iso_region: "TZ-02",
      municipality: "Dar es Salaam",
      iata_code: "DAR"
    },
    {
      name: "Abeid Amani Karume International Airport",
      latitude_deg: "-6.22202",
      longitude_deg: "39.224899",
      elevation_ft: 54,
      continent: "AF",
      iso_country: "TZ",
      iso_region: "TZ-07",
      municipality: "Zanzibar",
      iata_code: "ZNZ"
    },
    {
      name: "Entebbe International Airport",
      latitude_deg: "0.042386",
      longitude_deg: "32.443501",
      elevation_ft: 3782,
      continent: "AF",
      iso_country: "UG",
      iso_region: "UG-C",
      municipality: "Kampala",
      iata_code: "EBB"
    },
    {
      name: "Joint Base Andrews",
      latitude_deg: "38.810799",
      longitude_deg: "-76.866997",
      elevation_ft: 280,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-MD",
      municipality: "Camp Springs",
      iata_code: "ADW"
    },
    {
      name: "Hartsfield Jackson Atlanta International Airport",
      latitude_deg: "33.6367",
      longitude_deg: "-84.428101",
      elevation_ft: 1026,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-GA",
      municipality: "Atlanta",
      iata_code: "ATL"
    },
    {
      name: "Austin Bergstrom International Airport",
      latitude_deg: "30.197535",
      longitude_deg: "-97.662015",
      elevation_ft: 542,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-TX",
      municipality: "Austin",
      iata_code: "AUS"
    },
    {
      name: "Nashville International Airport",
      latitude_deg: "36.1245002746582",
      longitude_deg: "-86.6781997680664",
      elevation_ft: 599,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-TN",
      municipality: "Nashville",
      iata_code: "BNA"
    },
    {
      name: "Logan International Airport",
      latitude_deg: "42.3643",
      longitude_deg: "-71.005203",
      elevation_ft: 20,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-MA",
      municipality: "Boston",
      iata_code: "BOS"
    },
    {
      name: "Buffalo Niagara International Airport",
      latitude_deg: "42.94049835",
      longitude_deg: "-78.73220062",
      elevation_ft: 728,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-NY",
      municipality: "Buffalo",
      iata_code: "BUF"
    },
    {
      name: "Baltimore/Washington International Thurgood Marshall Airport",
      latitude_deg: "39.1754",
      longitude_deg: "-76.668297",
      elevation_ft: 146,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-MD",
      municipality: "Baltimore",
      iata_code: "BWI"
    },
    {
      name: "Cleveland Hopkins International Airport",
      latitude_deg: "41.4117012024",
      longitude_deg: "-81.8498001099",
      elevation_ft: 791,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-OH",
      municipality: "Cleveland",
      iata_code: "CLE"
    },
    {
      name: "Charlotte Douglas International Airport",
      latitude_deg: "35.2140007019043",
      longitude_deg: "-80.9430999755859",
      elevation_ft: 748,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-NC",
      municipality: "Charlotte",
      iata_code: "CLT"
    },
    {
      name: "Camarillo International Airport",
      latitude_deg: "34.213699",
      longitude_deg: "-119.094002",
      elevation_ft: 77,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-CA",
      municipality: "Camarillo",
      iata_code: ""
    },
    {
      name: "John Glenn Columbus International Airport",
      latitude_deg: "39.998001",
      longitude_deg: "-82.891899",
      elevation_ft: 815,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-OH",
      municipality: "Columbus",
      iata_code: "CMH"
    },
    {
      name: "Cincinnati Northern Kentucky International Airport",
      latitude_deg: "39.048801",
      longitude_deg: "-84.667801",
      elevation_ft: 896,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-KY",
      municipality: "Cincinnati / Covington",
      iata_code: "CVG"
    },
    {
      name: "Ronald Reagan Washington National Airport",
      latitude_deg: "38.8521",
      longitude_deg: "-77.037697",
      elevation_ft: 15,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-DC",
      municipality: "Washington",
      iata_code: "DCA"
    },
    {
      name: "Denver International Airport",
      latitude_deg: "39.861698150635",
      longitude_deg: "-104.672996521",
      elevation_ft: 5431,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-CO",
      municipality: "Denver",
      iata_code: "DEN"
    },
    {
      name: "Dallas Fort Worth International Airport",
      latitude_deg: "32.896801",
      longitude_deg: "-97.038002",
      elevation_ft: 607,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-TX",
      municipality: "Dallas-Fort Worth",
      iata_code: "DFW"
    },
    {
      name: "Detroit Metropolitan Wayne County Airport",
      latitude_deg: "42.2123985290527",
      longitude_deg: "-83.353401184082",
      elevation_ft: 645,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-MI",
      municipality: "Detroit",
      iata_code: "DTW"
    },
    {
      name: "Newark Liberty International Airport",
      latitude_deg: "40.692501",
      longitude_deg: "-74.168701",
      elevation_ft: 18,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-NJ",
      municipality: "New York",
      iata_code: "EWR"
    },
    {
      name: "Fort Lauderdale Hollywood International Airport",
      latitude_deg: "26.072599",
      longitude_deg: "-80.152702",
      elevation_ft: 9,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-FL",
      municipality: "Fort Lauderdale",
      iata_code: "FLL"
    },
    {
      name: "Washington Dulles International Airport",
      latitude_deg: "38.9445",
      longitude_deg: "-77.455803",
      elevation_ft: 312,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-VA",
      municipality: "Washington, DC",
      iata_code: "IAD"
    },
    {
      name: "George Bush Intercontinental Houston Airport",
      latitude_deg: "29.9843997955322",
      longitude_deg: "-95.3414001464844",
      elevation_ft: 97,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-TX",
      municipality: "Houston",
      iata_code: "IAH"
    },
    {
      name: "Indianapolis International Airport",
      latitude_deg: "39.7173",
      longitude_deg: "-86.294403",
      elevation_ft: 797,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-IN",
      municipality: "Indianapolis",
      iata_code: "IND"
    },
    {
      name: "Jacksonville International Airport",
      latitude_deg: "30.4941005706787",
      longitude_deg: "-81.6878967285156",
      elevation_ft: 30,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-FL",
      municipality: "Jacksonville",
      iata_code: "JAX"
    },
    {
      name: "John F Kennedy International Airport",
      latitude_deg: "40.639801",
      longitude_deg: "-73.7789",
      elevation_ft: 13,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-NY",
      municipality: "New York",
      iata_code: "JFK"
    },
    {
      name: "McCarran International Airport",
      latitude_deg: "36.08010101",
      longitude_deg: "-115.1520004",
      elevation_ft: 2181,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-NV",
      municipality: "Las Vegas",
      iata_code: "LAS"
    },
    {
      name: "Los Angeles International Airport",
      latitude_deg: "33.942501",
      longitude_deg: "-118.407997",
      elevation_ft: 125,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-CA",
      municipality: "Los Angeles",
      iata_code: "LAX"
    },
    {
      name: "La Guardia Airport",
      latitude_deg: "40.777199",
      longitude_deg: "-73.872597",
      elevation_ft: 21,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-NY",
      municipality: "New York",
      iata_code: "LGA"
    },
    {
      name: "Kansas City International Airport",
      latitude_deg: "39.2976",
      longitude_deg: "-94.713898",
      elevation_ft: 1026,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-MO",
      municipality: "Kansas City",
      iata_code: "MCI"
    },
    {
      name: "Orlando International Airport",
      latitude_deg: "28.4293994903564",
      longitude_deg: "-81.3089981079102",
      elevation_ft: 96,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-FL",
      municipality: "Orlando",
      iata_code: "MCO"
    },
    {
      name: "Chicago Midway International Airport",
      latitude_deg: "41.785999",
      longitude_deg: "-87.752403",
      elevation_ft: 620,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-IL",
      municipality: "Chicago",
      iata_code: "MDW"
    },
    {
      name: "Memphis International Airport",
      latitude_deg: "35.0424003601074",
      longitude_deg: "-89.9766998291016",
      elevation_ft: 341,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-TN",
      municipality: "Memphis",
      iata_code: "MEM"
    },
    {
      name: "Miami International Airport",
      latitude_deg: "25.7931995391846",
      longitude_deg: "-80.2906036376953",
      elevation_ft: 8,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-FL",
      municipality: "Miami",
      iata_code: "MIA"
    },
    {
      name: "General Mitchell International Airport",
      latitude_deg: "42.9472007751465",
      longitude_deg: "-87.896598815918",
      elevation_ft: 723,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-WI",
      municipality: "Milwaukee",
      iata_code: "MKE"
    },
    {
      name: "Minneapolis–Saint Paul International Airport / Wold–Chamberlain Field",
      latitude_deg: "44.882",
      longitude_deg: "-93.221802",
      elevation_ft: 841,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-MN",
      municipality: "Minneapolis",
      iata_code: "MSP"
    },
    {
      name: "Louis Armstrong New Orleans International Airport",
      latitude_deg: "29.9934005737305",
      longitude_deg: "-90.2580032348633",
      elevation_ft: 4,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-LA",
      municipality: "New Orleans",
      iata_code: "MSY"
    },
    {
      name: "Metropolitan Oakland International Airport",
      latitude_deg: "37.721298",
      longitude_deg: "-122.221001",
      elevation_ft: 9,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-CA",
      municipality: "Oakland",
      iata_code: "OAK"
    },
    {
      name: "Ontario International Airport",
      latitude_deg: "34.0559997558594",
      longitude_deg: "-117.600997924805",
      elevation_ft: 944,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-CA",
      municipality: "Ontario",
      iata_code: "ONT"
    },
    {
      name: "Chicago O'Hare International Airport",
      latitude_deg: "41.9786",
      longitude_deg: "-87.9048",
      elevation_ft: 672,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-IL",
      municipality: "Chicago",
      iata_code: "ORD"
    },
    {
      name: "Palm Beach International Airport",
      latitude_deg: "26.6832008361816",
      longitude_deg: "-80.0955963134766",
      elevation_ft: 19,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-FL",
      municipality: "West Palm Beach",
      iata_code: "PBI"
    },
    {
      name: "Portland International Airport",
      latitude_deg: "45.58869934",
      longitude_deg: "-122.5979996",
      elevation_ft: 31,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-OR",
      municipality: "Portland",
      iata_code: "PDX"
    },
    {
      name: "Philadelphia International Airport",
      latitude_deg: "39.871898651123",
      longitude_deg: "-75.241096496582",
      elevation_ft: 36,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-PA",
      municipality: "Philadelphia",
      iata_code: "PHL"
    },
    {
      name: "Phoenix Sky Harbor International Airport",
      latitude_deg: "33.435302",
      longitude_deg: "-112.005905",
      elevation_ft: 1135,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-AZ",
      municipality: "Phoenix",
      iata_code: "PHX"
    },
    {
      name: "Pittsburgh International Airport",
      latitude_deg: "40.49150085",
      longitude_deg: "-80.23290253",
      elevation_ft: 1203,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-PA",
      municipality: "Pittsburgh",
      iata_code: "PIT"
    },
    {
      name: "Theodore Francis Green State Airport",
      latitude_deg: "41.725038",
      longitude_deg: "-71.425668",
      elevation_ft: 55,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-RI",
      municipality: "Providence",
      iata_code: "PVD"
    },
    {
      name: "Portland International Jetport",
      latitude_deg: "43.646198",
      longitude_deg: "-70.309303",
      elevation_ft: 76,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-ME",
      municipality: "Portland",
      iata_code: "PWM"
    },
    {
      name: "Raleigh Durham International Airport",
      latitude_deg: "35.8776016235352",
      longitude_deg: "-78.7874984741211",
      elevation_ft: 435,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-NC",
      municipality: "Raleigh/Durham",
      iata_code: "RDU"
    },
    {
      name: "Richmond International Airport",
      latitude_deg: "37.505199432373",
      longitude_deg: "-77.3197021484375",
      elevation_ft: 167,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-VA",
      municipality: "Richmond",
      iata_code: "RIC"
    },
    {
      name: "Reno Tahoe International Airport",
      latitude_deg: "39.4990997314453",
      longitude_deg: "-119.767997741699",
      elevation_ft: 4415,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-NV",
      municipality: "Reno",
      iata_code: "RNO"
    },
    {
      name: "Southwest Florida International Airport",
      latitude_deg: "26.5361995697021",
      longitude_deg: "-81.7552032470703",
      elevation_ft: 30,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-FL",
      municipality: "Fort Myers",
      iata_code: "RSW"
    },
    {
      name: "San Diego International Airport",
      latitude_deg: "32.7336006165",
      longitude_deg: "-117.190002441",
      elevation_ft: 17,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-CA",
      municipality: "San Diego",
      iata_code: "SAN"
    },
    {
      name: "San Antonio International Airport",
      latitude_deg: "29.533701",
      longitude_deg: "-98.469803",
      elevation_ft: 809,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-TX",
      municipality: "San Antonio",
      iata_code: "SAT"
    },
    {
      name: "Savannah Hilton Head International Airport",
      latitude_deg: "32.12760162",
      longitude_deg: "-81.20210266",
      elevation_ft: 50,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-GA",
      municipality: "Savannah",
      iata_code: "SAV"
    },
    {
      name: "Louisville Muhammad Ali International Airport",
      latitude_deg: "38.1744",
      longitude_deg: "-85.736",
      elevation_ft: 501,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-KY",
      municipality: "Louisville",
      iata_code: "SDF"
    },
    {
      name: "Seattle Tacoma International Airport",
      latitude_deg: "47.449001",
      longitude_deg: "-122.308998",
      elevation_ft: 433,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-WA",
      municipality: "Seattle",
      iata_code: "SEA"
    },
    {
      name: "Orlando Sanford International Airport",
      latitude_deg: "28.7775993347168",
      longitude_deg: "-81.2375030517578",
      elevation_ft: 55,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-FL",
      municipality: "Orlando",
      iata_code: "SFB"
    },
    {
      name: "San Francisco International Airport",
      latitude_deg: "37.6189994812012",
      longitude_deg: "-122.375",
      elevation_ft: 13,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-CA",
      municipality: "San Francisco",
      iata_code: "SFO"
    },
    {
      name: "Norman Y. Mineta San Jose International Airport",
      latitude_deg: "37.362598",
      longitude_deg: "-121.929001",
      elevation_ft: 62,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-CA",
      municipality: "San Jose",
      iata_code: "SJC"
    },
    {
      name: "Salt Lake City International Airport",
      latitude_deg: "40.785749",
      longitude_deg: "-111.979746",
      elevation_ft: 4227,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-UT",
      municipality: "Salt Lake City",
      iata_code: "SLC"
    },
    {
      name: "Sacramento International Airport",
      latitude_deg: "38.6954002380371",
      longitude_deg: "-121.591003417969",
      elevation_ft: 27,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-CA",
      municipality: "Sacramento",
      iata_code: "SMF"
    },
    {
      name: "St Louis Lambert International Airport",
      latitude_deg: "38.748697",
      longitude_deg: "-90.370003",
      elevation_ft: 618,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-MO",
      municipality: "St Louis",
      iata_code: "STL"
    },
    {
      name: "Syracuse Hancock International Airport",
      latitude_deg: "43.111198425293",
      longitude_deg: "-76.1063003540039",
      elevation_ft: 421,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-NY",
      municipality: "Syracuse",
      iata_code: "SYR"
    },
    {
      name: "Tampa International Airport",
      latitude_deg: "27.9755001068115",
      longitude_deg: "-82.533203125",
      elevation_ft: 26,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-FL",
      municipality: "Tampa",
      iata_code: "TPA"
    },
    {
      name: "Tulsa International Airport",
      latitude_deg: "36.1983985900879",
      longitude_deg: "-95.8880996704102",
      elevation_ft: 677,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-OK",
      municipality: "Tulsa",
      iata_code: "TUL"
    },
    {
      name: "Tirana International Airport Mother Teresa",
      latitude_deg: "41.4146995544",
      longitude_deg: "19.7206001282",
      elevation_ft: 126,
      continent: "EU",
      iso_country: "AL",
      iso_region: "AL-11",
      municipality: "Tirana",
      iata_code: "TIA"
    },
    {
      name: "Burgas Airport",
      latitude_deg: "42.5695991516113",
      longitude_deg: "27.5151996612549",
      elevation_ft: 135,
      continent: "EU",
      iso_country: "BG",
      iso_region: "BG-02",
      municipality: "Burgas",
      iata_code: "BOJ"
    },
    {
      name: "Sofia Airport",
      latitude_deg: "42.6966934204102",
      longitude_deg: "23.4114360809326",
      elevation_ft: 1742,
      continent: "EU",
      iso_country: "BG",
      iso_region: "BG-23",
      municipality: "Sofia",
      iata_code: "SOF"
    },
    {
      name: "Varna Airport",
      latitude_deg: "43.232101",
      longitude_deg: "27.8251",
      elevation_ft: 230,
      continent: "EU",
      iso_country: "BG",
      iso_region: "BG-03",
      municipality: "Varna",
      iata_code: "VAR"
    },
    {
      name: "Larnaca International Airport",
      latitude_deg: "34.875099",
      longitude_deg: "33.624901",
      elevation_ft: 8,
      continent: "AS",
      iso_country: "CY",
      iso_region: "CY-04",
      municipality: "Larnaca",
      iata_code: "LCA"
    },
    {
      name: "Zagreb Airport",
      latitude_deg: "45.7429008484",
      longitude_deg: "16.0687999725",
      elevation_ft: 353,
      continent: "EU",
      iso_country: "HR",
      iso_region: "HR-21",
      municipality: "Zagreb",
      iata_code: "ZAG"
    },
    {
      name: "Alicante-Elche Miguel Hernández Airport",
      latitude_deg: "38.2822",
      longitude_deg: "-0.558156",
      elevation_ft: 142,
      continent: "EU",
      iso_country: "ES",
      iso_region: "ES-V",
      municipality: "Alicante",
      iata_code: "ALC"
    },
    {
      name: "Josep Tarradellas Barcelona-El Prat Airport",
      latitude_deg: "41.2971",
      longitude_deg: "2.07846",
      elevation_ft: 12,
      continent: "EU",
      iso_country: "ES",
      iso_region: "ES-CT",
      municipality: "Barcelona",
      iata_code: "BCN"
    },
    {
      name: "Ibiza Airport",
      latitude_deg: "38.872898",
      longitude_deg: "1.37312",
      elevation_ft: 24,
      continent: "EU",
      iso_country: "ES",
      iso_region: "ES-PM",
      municipality: "Ibiza",
      iata_code: "IBZ"
    },
    {
      name: "Adolfo Suárez Madrid–Barajas Airport",
      latitude_deg: "40.471926",
      longitude_deg: "-3.56264",
      elevation_ft: 1998,
      continent: "EU",
      iso_country: "ES",
      iso_region: "ES-M",
      municipality: "Madrid",
      iata_code: "MAD"
    },
    {
      name: "Málaga-Costa del Sol Airport",
      latitude_deg: "36.6749",
      longitude_deg: "-4.49911",
      elevation_ft: 53,
      continent: "EU",
      iso_country: "ES",
      iso_region: "ES-AN",
      municipality: "Málaga",
      iata_code: "AGP"
    },
    {
      name: "Palma de Mallorca Airport",
      latitude_deg: "39.551701",
      longitude_deg: "2.73881",
      elevation_ft: 27,
      continent: "EU",
      iso_country: "ES",
      iso_region: "ES-PM",
      municipality: "Palma De Mallorca",
      iata_code: "PMI"
    },
    {
      name: "Santiago-Rosalía de Castro Airport",
      latitude_deg: "42.896301",
      longitude_deg: "-8.41514",
      elevation_ft: 1213,
      continent: "EU",
      iso_country: "ES",
      iso_region: "ES-GA",
      municipality: "Santiago de Compostela",
      iata_code: "SCQ"
    },
    {
      name: "Bordeaux-Mérignac Airport",
      latitude_deg: "44.8283",
      longitude_deg: "-0.715556",
      elevation_ft: 162,
      continent: "EU",
      iso_country: "FR",
      iso_region: "FR-NAQ",
      municipality: "Bordeaux/Mérignac",
      iata_code: "BOD"
    },
    {
      name: "Toulouse-Blagnac Airport",
      latitude_deg: "43.629101",
      longitude_deg: "1.36382",
      elevation_ft: 499,
      continent: "EU",
      iso_country: "FR",
      iso_region: "FR-OCC",
      municipality: "Toulouse/Blagnac",
      iata_code: "TLS"
    },
    {
      name: "Lyon Saint-Exupéry Airport",
      latitude_deg: "45.725556",
      longitude_deg: "5.081111",
      elevation_ft: 821,
      continent: "EU",
      iso_country: "FR",
      iso_region: "FR-ARA",
      municipality: "Lyon",
      iata_code: "LYS"
    },
    {
      name: "Marseille Provence Airport",
      latitude_deg: "43.439271922",
      longitude_deg: "5.22142410278",
      elevation_ft: 74,
      continent: "EU",
      iso_country: "FR",
      iso_region: "FR-PAC",
      municipality: "Marseille",
      iata_code: "MRS"
    },
    {
      name: "Nice-Côte d'Azur Airport",
      latitude_deg: "43.6584014893",
      longitude_deg: "7.21586990356",
      elevation_ft: 12,
      continent: "EU",
      iso_country: "FR",
      iso_region: "FR-PAC",
      municipality: "Nice",
      iata_code: "NCE"
    },
    {
      name: "Charles de Gaulle International Airport",
      latitude_deg: "49.012798",
      longitude_deg: "2.55",
      elevation_ft: 392,
      continent: "EU",
      iso_country: "FR",
      iso_region: "FR-IDF",
      municipality: "Paris",
      iata_code: "CDG"
    },
    {
      name: "Paris-Orly Airport",
      latitude_deg: "48.7233333",
      longitude_deg: "2.3794444",
      elevation_ft: 291,
      continent: "EU",
      iso_country: "FR",
      iso_region: "FR-IDF",
      municipality: "Paris",
      iata_code: "ORY"
    },
    {
      name: "EuroAirport Basel-Mulhouse-Freiburg Airport",
      latitude_deg: "47.59",
      longitude_deg: "7.529167",
      elevation_ft: 885,
      continent: "EU",
      iso_country: "FR",
      iso_region: "FR-GES",
      municipality: "Bâle/Mulhouse",
      iata_code: "BSL"
    },
    {
      name: "Athens Eleftherios Venizelos International Airport",
      latitude_deg: "37.936401",
      longitude_deg: "23.9445",
      elevation_ft: 308,
      continent: "EU",
      iso_country: "GR",
      iso_region: "GR-I",
      municipality: "Athens",
      iata_code: "ATH"
    },
    {
      name: "Heraklion International Nikos Kazantzakis Airport",
      latitude_deg: "35.3396987915",
      longitude_deg: "25.1802997589",
      elevation_ft: 115,
      continent: "EU",
      iso_country: "GR",
      iso_region: "GR-91",
      municipality: "Heraklion",
      iata_code: "HER"
    },
    {
      name: "Thessaloniki Macedonia International Airport",
      latitude_deg: "40.5196990966797",
      longitude_deg: "22.9708995819092",
      elevation_ft: 22,
      continent: "EU",
      iso_country: "GR",
      iso_region: "GR-54",
      municipality: "Thessaloniki",
      iata_code: "SKG"
    },
    {
      name: "Budapest Liszt Ferenc International Airport",
      latitude_deg: "47.42976",
      longitude_deg: "19.261093",
      elevation_ft: 495,
      continent: "EU",
      iso_country: "HU",
      iso_region: "HU-PE",
      municipality: "Budapest",
      iata_code: "BUD"
    },
    {
      name: "Bari Karol Wojtyła Airport",
      latitude_deg: "41.138901",
      longitude_deg: "16.760599",
      elevation_ft: 177,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-75",
      municipality: "Bari",
      iata_code: "BRI"
    },
    {
      name: "Brindisi Airport",
      latitude_deg: "40.6576",
      longitude_deg: "17.947001",
      elevation_ft: 47,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-75",
      municipality: "Brindisi",
      iata_code: "BDS"
    },
    {
      name: "Catania-Fontanarossa Airport",
      latitude_deg: "37.466801",
      longitude_deg: "15.0664",
      elevation_ft: 39,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-82",
      municipality: "Catania",
      iata_code: "CTA"
    },
    {
      name: "Falcone–Borsellino Airport",
      latitude_deg: "38.175999",
      longitude_deg: "13.091",
      elevation_ft: 65,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-82",
      municipality: "Palermo",
      iata_code: "PMO"
    },
    {
      name: "Cagliari Elmas Airport",
      latitude_deg: "39.251499",
      longitude_deg: "9.05428",
      elevation_ft: 13,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-88",
      municipality: "Cagliari",
      iata_code: "CAG"
    },
    {
      name: "Malpensa International Airport",
      latitude_deg: "45.6306",
      longitude_deg: "8.72811",
      elevation_ft: 768,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-25",
      municipality: "Milan",
      iata_code: "MXP"
    },
    {
      name: "Milan Bergamo Airport",
      latitude_deg: "45.673901",
      longitude_deg: "9.70417",
      elevation_ft: 782,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-25",
      municipality: "Milan",
      iata_code: "BGY"
    },
    {
      name: "Turin Airport",
      latitude_deg: "45.200802",
      longitude_deg: "7.64963",
      elevation_ft: 989,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-21",
      municipality: "Torino",
      iata_code: "TRN"
    },
    {
      name: "Bologna Guglielmo Marconi Airport",
      latitude_deg: "44.5354",
      longitude_deg: "11.2887",
      elevation_ft: 123,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-45",
      municipality: "Bologna",
      iata_code: "BLQ"
    },
    {
      name: "Verona-Villafranca Valerio Catullo Airport",
      latitude_deg: "45.394955",
      longitude_deg: "10.887303",
      elevation_ft: 239,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-34",
      municipality: "Villafranca di Verona",
      iata_code: "VRN"
    },
    {
      name: "Venice Marco Polo Airport",
      latitude_deg: "45.505299",
      longitude_deg: "12.3519",
      elevation_ft: 7,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-34",
      municipality: "Venice",
      iata_code: "VCE"
    },
    {
      name: "Rome–Fiumicino Leonardo da Vinci International Airport",
      latitude_deg: "41.804532",
      longitude_deg: "12.251998",
      elevation_ft: 13,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-62",
      municipality: "Rome",
      iata_code: "FCO"
    },
    {
      name: "Naples International Airport",
      latitude_deg: "40.886002",
      longitude_deg: "14.2908",
      elevation_ft: 294,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-72",
      municipality: "Nápoli",
      iata_code: "NAP"
    },
    {
      name: "Pisa International Airport",
      latitude_deg: "43.683899",
      longitude_deg: "10.3927",
      elevation_ft: 6,
      continent: "EU",
      iso_country: "IT",
      iso_region: "IT-52",
      municipality: "Pisa",
      iata_code: "PSA"
    },
    {
      name: "Ljubljana Jože Pučnik Airport",
      latitude_deg: "46.223701",
      longitude_deg: "14.4576",
      elevation_ft: 1273,
      continent: "EU",
      iso_country: "SI",
      iso_region: "SI-061",
      municipality: "Ljubljana",
      iata_code: "LJU"
    },
    {
      name: "Václav Havel Airport Prague",
      latitude_deg: "50.1008",
      longitude_deg: "14.26",
      elevation_ft: 1247,
      continent: "EU",
      iso_country: "CZ",
      iso_region: "CZ-PR",
      municipality: "Prague",
      iata_code: "PRG"
    },
    {
      name: "Ben Gurion International Airport",
      latitude_deg: "32.0113983154297",
      longitude_deg: "34.8866996765137",
      elevation_ft: 135,
      continent: "AS",
      iso_country: "IL",
      iso_region: "IL-M",
      municipality: "Tel Aviv",
      iata_code: "TLV"
    },
    {
      name: "Ramon International Airport",
      latitude_deg: "29.727009",
      longitude_deg: "35.014116",
      elevation_ft: 288,
      continent: "AS",
      iso_country: "IL",
      iso_region: "IL-D",
      municipality: "Eilat",
      iata_code: "ETM"
    },
    {
      name: "Malta International Airport",
      latitude_deg: "35.857498",
      longitude_deg: "14.4775",
      elevation_ft: 300,
      continent: "EU",
      iso_country: "MT",
      iso_region: "MT-25",
      municipality: "Valletta",
      iata_code: "MLA"
    },
    {
      name: "Vienna International Airport",
      latitude_deg: "48.110298",
      longitude_deg: "16.5697",
      elevation_ft: 600,
      continent: "EU",
      iso_country: "AT",
      iso_region: "AT-9",
      municipality: "Vienna",
      iata_code: "VIE"
    },
    {
      name: "Faro Airport",
      latitude_deg: "37.0144004822",
      longitude_deg: "-7.96590995789",
      elevation_ft: 24,
      continent: "EU",
      iso_country: "PT",
      iso_region: "PT-08",
      municipality: "Faro",
      iata_code: "FAO"
    },
    {
      name: "João Paulo II Airport",
      latitude_deg: "37.7411994934",
      longitude_deg: "-25.6979007721",
      elevation_ft: 259,
      continent: "EU",
      iso_country: "PT",
      iso_region: "PT-20",
      municipality: "Ponta Delgada",
      iata_code: "PDL"
    },
    {
      name: "Francisco de Sá Carneiro Airport",
      latitude_deg: "41.2481002808",
      longitude_deg: "-8.68138980865",
      elevation_ft: 228,
      continent: "EU",
      iso_country: "PT",
      iso_region: "PT-13",
      municipality: "Porto",
      iata_code: "OPO"
    },
    {
      name: "Humberto Delgado Airport (Lisbon Portela Airport)",
      latitude_deg: "38.7813",
      longitude_deg: "-9.13592",
      elevation_ft: 374,
      continent: "EU",
      iso_country: "PT",
      iso_region: "PT-11",
      municipality: "Lisbon",
      iata_code: "LIS"
    },
    {
      name: "Henri Coandă International Airport",
      latitude_deg: "44.571111",
      longitude_deg: "26.085",
      elevation_ft: 314,
      continent: "EU",
      iso_country: "RO",
      iso_region: "RO-IF",
      municipality: "Bucharest",
      iata_code: "OTP"
    },
    {
      name: "Geneva Cointrin International Airport",
      latitude_deg: "46.2380981445313",
      longitude_deg: "6.10895013809204",
      elevation_ft: 1411,
      continent: "EU",
      iso_country: "CH",
      iso_region: "CH-GE",
      municipality: "Geneva",
      iata_code: "GVA"
    },
    {
      name: "Zürich Airport",
      latitude_deg: "47.458056",
      longitude_deg: "8.548056",
      elevation_ft: 1417,
      continent: "EU",
      iso_country: "CH",
      iso_region: "CH-ZH",
      municipality: "Zurich",
      iata_code: "ZRH"
    },
    {
      name: "Esenboğa International Airport",
      latitude_deg: "40.1281013489",
      longitude_deg: "32.995098114",
      elevation_ft: 3125,
      continent: "AS",
      iso_country: "TR",
      iso_region: "TR-06",
      municipality: "Ankara",
      iata_code: "ESB"
    },
    {
      name: "Antalya International Airport",
      latitude_deg: "36.898701",
      longitude_deg: "30.800501",
      elevation_ft: 177,
      continent: "AS",
      iso_country: "TR",
      iso_region: "TR-07",
      municipality: "Antalya",
      iata_code: "AYT"
    },
    {
      name: "İstanbul Atatürk Airport",
      latitude_deg: "40.971913",
      longitude_deg: "28.823714",
      elevation_ft: 163,
      continent: "EU",
      iso_country: "TR",
      iso_region: "TR-34",
      municipality: "Bakırköy, Istanbul",
      iata_code: "ISL"
    },
    {
      name: "Adnan Menderes International Airport",
      latitude_deg: "38.2924",
      longitude_deg: "27.157",
      elevation_ft: 412,
      continent: "AS",
      iso_country: "TR",
      iso_region: "TR-35",
      municipality: "İzmir",
      iata_code: "ADB"
    },
    {
      name: "Dalaman International Airport",
      latitude_deg: "36.7131004333",
      longitude_deg: "28.7924995422",
      elevation_ft: 20,
      continent: "AS",
      iso_country: "TR",
      iso_region: "TR-48",
      municipality: "Dalaman",
      iata_code: "DLM"
    },
    {
      name: "Milas Bodrum International Airport",
      latitude_deg: "37.2505989075",
      longitude_deg: "27.6643009186",
      elevation_ft: 21,
      continent: "AS",
      iso_country: "TR",
      iso_region: "TR-48",
      municipality: "Bodrum",
      iata_code: "BJV"
    },
    {
      name: "Istanbul Sabiha Gökçen International Airport",
      latitude_deg: "40.898602",
      longitude_deg: "29.3092",
      elevation_ft: 312,
      continent: "AS",
      iso_country: "TR",
      iso_region: "TR-34",
      municipality: "Pendik, Istanbul",
      iata_code: "SAW"
    },
    {
      name: "İstanbul Airport",
      latitude_deg: "41.261297",
      longitude_deg: "28.741951",
      elevation_ft: 325,
      continent: "EU",
      iso_country: "TR",
      iso_region: "TR-34",
      municipality: "Arnavutköy, Istanbul",
      iata_code: "IST"
    },
    {
      name: "Skopje International Airport",
      latitude_deg: "41.961601",
      longitude_deg: "21.621401",
      elevation_ft: 781,
      continent: "EU",
      iso_country: "MK",
      iso_region: "MK-004",
      municipality: "Skopje",
      iata_code: "SKP"
    },
    {
      name: "Belgrade Nikola Tesla Airport",
      latitude_deg: "44.8184013367",
      longitude_deg: "20.3090991974",
      elevation_ft: 335,
      continent: "EU",
      iso_country: "RS",
      iso_region: "RS-00",
      municipality: "Belgrade",
      iata_code: "BEG"
    },
    {
      name: "Podgorica Airport / Podgorica Golubovci Airbase",
      latitude_deg: "42.359402",
      longitude_deg: "19.2519",
      elevation_ft: 141,
      continent: "EU",
      iso_country: "ME",
      iso_region: "ME-16",
      municipality: "Podgorica",
      iata_code: "TGD"
    },
    {
      name: "M. R. Štefánik Airport",
      latitude_deg: "48.1702003479004",
      longitude_deg: "17.2126998901367",
      elevation_ft: 436,
      continent: "EU",
      iso_country: "SK",
      iso_region: "SK-BL",
      municipality: "Bratislava",
      iata_code: "BTS"
    },
    {
      name: "Providenciales International Airport",
      latitude_deg: "21.773697",
      longitude_deg: "-72.268321",
      elevation_ft: 15,
      continent: "NA",
      iso_country: "TC",
      iso_region: "TC-PR",
      municipality: "Providenciales",
      iata_code: "PLS"
    },
    {
      name: "Punta Cana International Airport",
      latitude_deg: "18.5673999786",
      longitude_deg: "-68.3634033203",
      elevation_ft: 47,
      continent: "NA",
      iso_country: "DO",
      iso_region: "DO-11",
      municipality: "Punta Cana",
      iata_code: "PUJ"
    },
    {
      name: "Las Américas International Airport",
      latitude_deg: "18.42970085144",
      longitude_deg: "-69.668899536133",
      elevation_ft: 59,
      continent: "NA",
      iso_country: "DO",
      iso_region: "DO-01",
      municipality: "Santo Domingo",
      iata_code: "SDQ"
    },
    {
      name: "La Aurora Airport",
      latitude_deg: "14.5833",
      longitude_deg: "-90.527496",
      elevation_ft: 4952,
      continent: "NA",
      iso_country: "GT",
      iso_region: "GT-GU",
      municipality: "Guatemala City",
      iata_code: "GUA"
    },
    {
      name: "Norman Manley International Airport",
      latitude_deg: "17.9356994628906",
      longitude_deg: "-76.7874984741211",
      elevation_ft: 10,
      continent: "NA",
      iso_country: "JM",
      iso_region: "JM-01",
      municipality: "Kingston",
      iata_code: "KIN"
    },
    {
      name: "General Juan N Alvarez International Airport",
      latitude_deg: "16.757099",
      longitude_deg: "-99.753998",
      elevation_ft: 16,
      continent: "NA",
      iso_country: "MX",
      iso_region: "MX-GRO",
      municipality: "Acapulco",
      iata_code: "ACA"
    },
    {
      name: "Don Miguel Hidalgo Y Costilla International Airport",
      latitude_deg: "20.5217990875244",
      longitude_deg: "-103.310997009277",
      elevation_ft: 5016,
      continent: "NA",
      iso_country: "MX",
      iso_region: "MX-JAL",
      municipality: "Guadalajara",
      iata_code: "GDL"
    },
    {
      name: "General Ignacio P. Garcia International Airport",
      latitude_deg: "29.0958995819",
      longitude_deg: "-111.047996521",
      elevation_ft: 627,
      continent: "NA",
      iso_country: "MX",
      iso_region: "MX-SON",
      municipality: "Hermosillo",
      iata_code: "HMO"
    },
    {
      name: "Licenciado Benito Juarez International Airport",
      latitude_deg: "19.4363",
      longitude_deg: "-99.072098",
      elevation_ft: 7316,
      continent: "NA",
      iso_country: "MX",
      iso_region: "MX-DIF",
      municipality: "Mexico City",
      iata_code: "MEX"
    },
    {
      name: "General Rafael Buelna International Airport",
      latitude_deg: "23.1614",
      longitude_deg: "-106.265999",
      elevation_ft: 38,
      continent: "NA",
      iso_country: "MX",
      iso_region: "MX-SIN",
      municipality: "Mazatlán",
      iata_code: "MZT"
    },
    {
      name: "President Gustavo Díaz Ordaz International Airport",
      latitude_deg: "20.680099",
      longitude_deg: "-105.253998",
      elevation_ft: 23,
      continent: "NA",
      iso_country: "MX",
      iso_region: "MX-JAL",
      municipality: "Puerto Vallarta",
      iata_code: "PVR"
    },
    {
      name: "Los Cabos International Airport",
      latitude_deg: "23.1518",
      longitude_deg: "-109.721001",
      elevation_ft: 374,
      continent: "NA",
      iso_country: "MX",
      iso_region: "MX-BCS",
      municipality: "San José del Cabo",
      iata_code: "SJD"
    },
    {
      name: "Santa Lucía Air Force Base / General Felipe Ángeles International Airport",
      latitude_deg: "19.7458",
      longitude_deg: "-99.0145",
      elevation_ft: 7369,
      continent: "NA",
      iso_country: "MX",
      iso_region: "MX-MEX",
      municipality: "Mexico City (Santa Lucía)",
      iata_code: "NLU"
    },
    {
      name: "General Abelardo L. Rodríguez International Airport",
      latitude_deg: "32.5410995483398",
      longitude_deg: "-116.970001220703",
      elevation_ft: 489,
      continent: "NA",
      iso_country: "MX",
      iso_region: "MX-BCN",
      municipality: "Tijuana",
      iata_code: "TIJ"
    },
    {
      name: "Cancún International Airport",
      latitude_deg: "21.0365009308",
      longitude_deg: "-86.8770980835",
      elevation_ft: 22,
      continent: "NA",
      iso_country: "MX",
      iso_region: "MX-ROO",
      municipality: "Cancún",
      iata_code: "CUN"
    },
    {
      name: "Tocumen International Airport",
      latitude_deg: "9.0713596344",
      longitude_deg: "-79.3834991455",
      elevation_ft: 135,
      continent: "NA",
      iso_country: "PA",
      iso_region: "PA-8",
      municipality: "Tocumen",
      iata_code: "PTY"
    },
    {
      name: "Guanacaste Airport",
      latitude_deg: "10.5933",
      longitude_deg: "-85.544403",
      elevation_ft: 270,
      continent: "NA",
      iso_country: "CR",
      iso_region: "CR-G",
      municipality: "Liberia",
      iata_code: "LIR"
    },
    {
      name: "Monseñor Óscar Arnulfo Romero International Airport",
      latitude_deg: "13.4409",
      longitude_deg: "-89.055702",
      elevation_ft: 101,
      continent: "NA",
      iso_country: "SV",
      iso_region: "SV-PA",
      municipality: "San Salvador (San Luis Talpa)",
      iata_code: "SAL"
    },
    {
      name: "Toussaint Louverture International Airport",
      latitude_deg: "18.58",
      longitude_deg: "-72.292503",
      elevation_ft: 122,
      continent: "NA",
      iso_country: "HT",
      iso_region: "HT-OU",
      municipality: "Port-au-Prince",
      iata_code: "PAP"
    },
    {
      name: "José Martí International Airport",
      latitude_deg: "22.989200592041",
      longitude_deg: "-82.4091033935547",
      elevation_ft: 210,
      continent: "NA",
      iso_country: "CU",
      iso_region: "CU-03",
      municipality: "Havana",
      iata_code: "HAV"
    },
    {
      name: "Juan Gualberto Gomez International Airport",
      latitude_deg: "23.0344009399414",
      longitude_deg: "-81.435302734375",
      elevation_ft: 210,
      continent: "NA",
      iso_country: "CU",
      iso_region: "CU-04",
      municipality: "Varadero",
      iata_code: "VRA"
    },
    {
      name: "Owen Roberts International Airport",
      latitude_deg: "19.2928009033",
      longitude_deg: "-81.3576965332",
      elevation_ft: 8,
      continent: "NA",
      iso_country: "KY",
      iso_region: "KY-U-A",
      municipality: "Georgetown",
      iata_code: "GCM"
    },
    {
      name: "Lynden Pindling International Airport",
      latitude_deg: "25.039",
      longitude_deg: "-77.466202",
      elevation_ft: 16,
      continent: "NA",
      iso_country: "BS",
      iso_region: "BS-NP",
      municipality: "Nassau",
      iata_code: "NAS"
    },
    {
      name: "Philip S. W. Goldson International Airport",
      latitude_deg: "17.5391006469727",
      longitude_deg: "-88.3081970214844",
      elevation_ft: 15,
      continent: "NA",
      iso_country: "BZ",
      iso_region: "BZ-BZ",
      municipality: "Belize City",
      iata_code: "BZE"
    },
    {
      name: "Rarotonga International Airport",
      latitude_deg: "-21.2026996613",
      longitude_deg: "-159.805999756",
      elevation_ft: 19,
      continent: "OC",
      iso_country: "CK",
      iso_region: "CK-U-A",
      municipality: "Avarua",
      iata_code: "RAR"
    },
    {
      name: "Faa'a International Airport",
      latitude_deg: "-17.553699",
      longitude_deg: "-149.606995",
      elevation_ft: 5,
      continent: "OC",
      iso_country: "PF",
      iso_region: "PF-U-A",
      municipality: "Papeete",
      iata_code: "PPT"
    },
    {
      name: "Bauerfield International Airport",
      latitude_deg: "-17.699301",
      longitude_deg: "168.320007",
      elevation_ft: 70,
      continent: "OC",
      iso_country: "VU",
      iso_region: "VU-SEE",
      municipality: "Port Vila",
      iata_code: "VLI"
    },
    {
      name: "Nouméa Magenta Airport",
      latitude_deg: "-22.258301",
      longitude_deg: "166.473007",
      elevation_ft: 10,
      continent: "OC",
      iso_country: "NC",
      iso_region: "NC-U-A",
      municipality: "Nouméa",
      iata_code: "GEA"
    },
    {
      name: "Auckland International Airport",
      latitude_deg: "-37.01199",
      longitude_deg: "174.786331",
      elevation_ft: 23,
      continent: "OC",
      iso_country: "NZ",
      iso_region: "NZ-AUK",
      municipality: "Auckland",
      iata_code: "AKL"
    },
    {
      name: "Christchurch International Airport",
      latitude_deg: "-43.4893989562988",
      longitude_deg: "172.531997680664",
      elevation_ft: 123,
      continent: "OC",
      iso_country: "NZ",
      iso_region: "NZ-CAN",
      municipality: "Christchurch",
      iata_code: "CHC"
    },
    {
      name: "Wellington International Airport",
      latitude_deg: "-41.3272018433",
      longitude_deg: "174.804992676",
      elevation_ft: 41,
      continent: "OC",
      iso_country: "NZ",
      iso_region: "NZ-WGN",
      municipality: "Wellington",
      iata_code: "WLG"
    },
    {
      name: "Bahrain International Airport",
      latitude_deg: "26.267295",
      longitude_deg: "50.63764",
      elevation_ft: 6,
      continent: "AS",
      iso_country: "BH",
      iso_region: "BH-15",
      municipality: "Manama",
      iata_code: "BAH"
    },
    {
      name: "King Fahd International Airport",
      latitude_deg: "26.4712009429932",
      longitude_deg: "49.7979011535645",
      elevation_ft: 72,
      continent: "AS",
      iso_country: "SA",
      iso_region: "SA-04",
      municipality: "Ad Dammam",
      iata_code: "DMM"
    },
    {
      name: "King Abdulaziz Air Base",
      latitude_deg: "26.2654",
      longitude_deg: "50.152",
      elevation_ft: 84,
      continent: "AS",
      iso_country: "SA",
      iso_region: "SA-04",
      municipality: "Dhahran",
      iata_code: "DHA"
    },
    {
      name: "King Abdulaziz International Airport",
      latitude_deg: "21.6796",
      longitude_deg: "39.156502",
      elevation_ft: 48,
      continent: "AS",
      iso_country: "SA",
      iso_region: "SA-02",
      municipality: "Jeddah",
      iata_code: "JED"
    },
    {
      name: "Prince Mohammad Bin Abdulaziz Airport",
      latitude_deg: "24.5534",
      longitude_deg: "39.705101",
      elevation_ft: 2151,
      continent: "AS",
      iso_country: "SA",
      iso_region: "SA-03",
      municipality: "Medina",
      iata_code: "MED"
    },
    {
      name: "King Khaled International Airport",
      latitude_deg: "24.9575996398926",
      longitude_deg: "46.6987991333008",
      elevation_ft: 2049,
      continent: "AS",
      iso_country: "SA",
      iso_region: "SA-01",
      municipality: "Riyadh",
      iata_code: "RUH"
    },
    {
      name: "Imam Khomeini International Airport",
      latitude_deg: "35.4160995483398",
      longitude_deg: "51.1521987915039",
      elevation_ft: 3305,
      continent: "AS",
      iso_country: "IR",
      iso_region: "IR-23",
      municipality: "Tehran",
      iata_code: "IKA"
    },
    {
      name: "Mehrabad International Airport",
      latitude_deg: "35.6892013549805",
      longitude_deg: "51.3134002685547",
      elevation_ft: 3962,
      continent: "AS",
      iso_country: "IR",
      iso_region: "IR-23",
      municipality: "Tehran",
      iata_code: "THR"
    },
    {
      name: "Mashhad International Airport",
      latitude_deg: "36.2351989746094",
      longitude_deg: "59.640998840332",
      elevation_ft: 3263,
      continent: "AS",
      iso_country: "IR",
      iso_region: "IR-09",
      municipality: "Mashhad",
      iata_code: "MHD"
    },
    {
      name: "Shiraz Shahid Dastghaib International Airport",
      latitude_deg: "29.5392",
      longitude_deg: "52.589802",
      elevation_ft: 4927,
      continent: "AS",
      iso_country: "IR",
      iso_region: "IR-07",
      municipality: "Shiraz",
      iata_code: "SYZ"
    },
    {
      name: "Queen Alia International Airport",
      latitude_deg: "31.7226009369",
      longitude_deg: "35.9931983948",
      elevation_ft: 2395,
      continent: "AS",
      iso_country: "JO",
      iso_region: "JO-AM",
      municipality: "Amman",
      iata_code: "AMM"
    },
    {
      name: "Kuwait International Airport",
      latitude_deg: "29.2266006469727",
      longitude_deg: "47.9688987731934",
      elevation_ft: 206,
      continent: "AS",
      iso_country: "KW",
      iso_region: "KW-FA",
      municipality: "Kuwait City",
      iata_code: "KWI"
    },
    {
      name: "Beirut Rafic Hariri International Airport",
      latitude_deg: "33.8208999633789",
      longitude_deg: "35.4883995056152",
      elevation_ft: 87,
      continent: "AS",
      iso_country: "LB",
      iso_region: "LB-JL",
      municipality: "Beirut",
      iata_code: "BEY"
    },
    {
      name: "Duqm International Airport",
      latitude_deg: "19.501944",
      longitude_deg: "57.634167",
      elevation_ft: 364,
      continent: "AS",
      iso_country: "OM",
      iso_region: "OM-WU",
      municipality: "Duqm",
      iata_code: "DQM"
    },
    {
      name: "Abu Dhabi International Airport",
      latitude_deg: "24.443764",
      longitude_deg: "54.651718",
      elevation_ft: 88,
      continent: "AS",
      iso_country: "AE",
      iso_region: "AE-AZ",
      municipality: "Abu Dhabi",
      iata_code: "AUH"
    },
    {
      name: "Dubai International Airport",
      latitude_deg: "25.2527999878",
      longitude_deg: "55.3643989563",
      elevation_ft: 62,
      continent: "AS",
      iso_country: "AE",
      iso_region: "AE-DU",
      municipality: "Dubai",
      iata_code: "DXB"
    },
    {
      name: "Al Maktoum International Airport",
      latitude_deg: "24.896356",
      longitude_deg: "55.161389",
      elevation_ft: 114,
      continent: "AS",
      iso_country: "AE",
      iso_region: "AE-DU",
      municipality: "Jebel Ali",
      iata_code: "DWC"
    },
    {
      name: "Sharjah International Airport",
      latitude_deg: "25.3285999298096",
      longitude_deg: "55.5172004699707",
      elevation_ft: 111,
      continent: "AS",
      iso_country: "AE",
      iso_region: "AE-SH",
      municipality: "Sharjah",
      iata_code: "SHJ"
    },
    {
      name: "Muscat International Airport",
      latitude_deg: "23.5932998657227",
      longitude_deg: "58.2844009399414",
      elevation_ft: 48,
      continent: "AS",
      iso_country: "OM",
      iso_region: "OM-MA",
      municipality: "Muscat",
      iata_code: "MCT"
    },
    {
      name: "Islamabad International Airport",
      latitude_deg: "33.549",
      longitude_deg: "72.82566",
      elevation_ft: 1761,
      continent: "AS",
      iso_country: "PK",
      iso_region: "PK-PB",
      municipality: "Islamabad",
      iata_code: "ISB"
    },
    {
      name: "Jinnah International Airport",
      latitude_deg: "24.9065",
      longitude_deg: "67.160797",
      elevation_ft: 100,
      continent: "AS",
      iso_country: "PK",
      iso_region: "PK-SD",
      municipality: "Karachi",
      iata_code: "KHI"
    },
    {
      name: "Allama Iqbal International Airport",
      latitude_deg: "31.521601",
      longitude_deg: "74.403603",
      elevation_ft: 712,
      continent: "AS",
      iso_country: "PK",
      iso_region: "PK-PB",
      municipality: "Lahore",
      iata_code: "LHE"
    },
    {
      name: "Baghdad International Airport / New Al Muthana Air Base",
      latitude_deg: "33.262501",
      longitude_deg: "44.2346",
      elevation_ft: 114,
      continent: "AS",
      iso_country: "IQ",
      iso_region: "IQ-BG",
      municipality: "Baghdad",
      iata_code: "BGW"
    },
    {
      name: "Damascus International Airport",
      latitude_deg: "33.4114990234375",
      longitude_deg: "36.5155982971191",
      elevation_ft: 2020,
      continent: "AS",
      iso_country: "SY",
      iso_region: "SY-DI",
      municipality: "Damascus",
      iata_code: "DAM"
    },
    {
      name: "Hamad International Airport",
      latitude_deg: "25.273056",
      longitude_deg: "51.608056",
      elevation_ft: 13,
      continent: "AS",
      iso_country: "QA",
      iso_region: "QA-DA",
      municipality: "Doha",
      iata_code: "DOH"
    },
    {
      name: "Fairbanks International Airport",
      latitude_deg: "64.81510162",
      longitude_deg: "-147.8560028",
      elevation_ft: 439,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-AK",
      municipality: "Fairbanks",
      iata_code: "FAI"
    },
    {
      name: "Ted Stevens Anchorage International Airport",
      latitude_deg: "61.1744",
      longitude_deg: "-149.996002",
      elevation_ft: 152,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-AK",
      municipality: "Anchorage",
      iata_code: "ANC"
    },
    {
      name: "Antonio B. Won Pat International Airport",
      latitude_deg: "13.4834",
      longitude_deg: "144.796005",
      elevation_ft: 298,
      continent: "OC",
      iso_country: "GU",
      iso_region: "GU-U-A",
      municipality: "Hagåtña, Guam International Airport",
      iata_code: "GUM"
    },
    {
      name: "Daniel K Inouye International Airport",
      latitude_deg: "21.32062",
      longitude_deg: "-157.924228",
      elevation_ft: 13,
      continent: "OC",
      iso_country: "US",
      iso_region: "US-HI",
      municipality: "Honolulu",
      iata_code: "HNL"
    },
    {
      name: "Kaohsiung International Airport",
      latitude_deg: "22.577101",
      longitude_deg: "120.349998",
      elevation_ft: 31,
      continent: "AS",
      iso_country: "TW",
      iso_region: "TW-KHH",
      municipality: "Kaohsiung (Xiaogang)",
      iata_code: "KHH"
    },
    {
      name: "Taiwan Taoyuan International Airport",
      latitude_deg: "25.0777",
      longitude_deg: "121.233002",
      elevation_ft: 106,
      continent: "AS",
      iso_country: "TW",
      iso_region: "TW-TAO",
      municipality: "Taipei",
      iata_code: "TPE"
    },
    {
      name: "Narita International Airport",
      latitude_deg: "35.764702",
      longitude_deg: "140.386002",
      elevation_ft: 141,
      continent: "AS",
      iso_country: "JP",
      iso_region: "JP-12",
      municipality: "Tokyo",
      iata_code: "NRT"
    },
    {
      name: "Kansai International Airport",
      latitude_deg: "34.427299",
      longitude_deg: "135.244003",
      elevation_ft: 26,
      continent: "AS",
      iso_country: "JP",
      iso_region: "JP-27",
      municipality: "Osaka",
      iata_code: "KIX"
    },
    {
      name: "New Chitose Airport",
      latitude_deg: "42.7752",
      longitude_deg: "141.692001",
      elevation_ft: 82,
      continent: "AS",
      iso_country: "JP",
      iso_region: "JP-01",
      municipality: "Sapporo",
      iata_code: "CTS"
    },
    {
      name: "Fukuoka Airport",
      latitude_deg: "33.5858993530273",
      longitude_deg: "130.45100402832",
      elevation_ft: 32,
      continent: "AS",
      iso_country: "JP",
      iso_region: "JP-40",
      municipality: "Fukuoka",
      iata_code: "FUK"
    },
    {
      name: "Kagoshima Airport",
      latitude_deg: "31.8034000396729",
      longitude_deg: "130.718994140625",
      elevation_ft: 906,
      continent: "AS",
      iso_country: "JP",
      iso_region: "JP-46",
      municipality: "Kagoshima",
      iata_code: "KOJ"
    },
    {
      name: "Chubu Centrair International Airport",
      latitude_deg: "34.8583984375",
      longitude_deg: "136.804992675781",
      elevation_ft: 15,
      continent: "AS",
      iso_country: "JP",
      iso_region: "JP-23",
      municipality: "Tokoname",
      iata_code: "NGO"
    },
    {
      name: "Osaka International Airport",
      latitude_deg: "34.7854995727539",
      longitude_deg: "135.438003540039",
      elevation_ft: 50,
      continent: "AS",
      iso_country: "JP",
      iso_region: "JP-27",
      municipality: "Osaka",
      iata_code: "ITM"
    },
    {
      name: "Sendai Airport",
      latitude_deg: "38.139702",
      longitude_deg: "140.917007",
      elevation_ft: 15,
      continent: "AS",
      iso_country: "JP",
      iso_region: "JP-04",
      municipality: "Natori",
      iata_code: "SDJ"
    },
    {
      name: "Tokyo Haneda International Airport",
      latitude_deg: "35.552299",
      longitude_deg: "139.779999",
      elevation_ft: 35,
      continent: "AS",
      iso_country: "JP",
      iso_region: "JP-13",
      municipality: "Tokyo",
      iata_code: "HND"
    },
    {
      name: "Yokota Air Base",
      latitude_deg: "35.7485008239746",
      longitude_deg: "139.348007202148",
      elevation_ft: 463,
      continent: "AS",
      iso_country: "JP",
      iso_region: "JP-13",
      municipality: "Fussa",
      iata_code: "OKO"
    },
    {
      name: "Muan International Airport",
      latitude_deg: "34.991406",
      longitude_deg: "126.382814",
      elevation_ft: 35,
      continent: "AS",
      iso_country: "KR",
      iso_region: "KR-46",
      municipality: "Piseo-ri (Muan)",
      iata_code: "MWX"
    },
    {
      name: "Jeju International Airport",
      latitude_deg: "33.5112991333008",
      longitude_deg: "126.49299621582",
      elevation_ft: 118,
      continent: "AS",
      iso_country: "KR",
      iso_region: "KR-49",
      municipality: "Jeju City",
      iata_code: "CJU"
    },
    {
      name: "Gimhae International Airport",
      latitude_deg: "35.179501",
      longitude_deg: "128.938004",
      elevation_ft: 6,
      continent: "AS",
      iso_country: "KR",
      iso_region: "KR-26",
      municipality: "Busan",
      iata_code: "PUS"
    },
    {
      name: "Incheon International Airport",
      latitude_deg: "37.4691009521484",
      longitude_deg: "126.450996398926",
      elevation_ft: 23,
      continent: "AS",
      iso_country: "KR",
      iso_region: "KR-28",
      municipality: "Seoul",
      iata_code: "ICN"
    },
    {
      name: "Gimpo International Airport",
      latitude_deg: "37.5583",
      longitude_deg: "126.791",
      elevation_ft: 59,
      continent: "AS",
      iso_country: "KR",
      iso_region: "KR-11",
      municipality: "Seoul",
      iata_code: "GMP"
    },
    {
      name: "Naha Airport / JASDF Naha Air Base",
      latitude_deg: "26.195801",
      longitude_deg: "127.646004",
      elevation_ft: 12,
      continent: "AS",
      iso_country: "JP",
      iso_region: "JP-47",
      municipality: "Naha",
      iata_code: "OKA"
    },
    {
      name: "Kadena Air Base",
      latitude_deg: "26.351667",
      longitude_deg: "127.769444",
      elevation_ft: 143,
      continent: "AS",
      iso_country: "JP",
      iso_region: "JP-47",
      municipality: "",
      iata_code: "DNA"
    },
    {
      name: "Ninoy Aquino International Airport",
      latitude_deg: "14.5086",
      longitude_deg: "121.019997",
      elevation_ft: 75,
      continent: "AS",
      iso_country: "PH",
      iso_region: "PH-00",
      municipality: "Manila",
      iata_code: "MNL"
    },
    {
      name: "Francisco Bangoy International Airport",
      latitude_deg: "7.12552",
      longitude_deg: "125.646004",
      elevation_ft: 96,
      continent: "AS",
      iso_country: "PH",
      iso_region: "PH-DAS",
      municipality: "Davao",
      iata_code: "DVO"
    },
    {
      name: "Mactan Cebu International Airport",
      latitude_deg: "10.307499885559",
      longitude_deg: "123.97899627686",
      elevation_ft: 31,
      continent: "AS",
      iso_country: "PH",
      iso_region: "PH-CEB",
      municipality: "Lapu-Lapu City",
      iata_code: "CEB"
    },
    {
      name: "Lipetsk Air Base",
      latitude_deg: "52.6349983215332",
      longitude_deg: "39.4449996948242",
      elevation_ft: 636,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-LIP",
      municipality: "Lipetsk",
      iata_code: ""
    },
    {
      name: "Olenya Air Base",
      latitude_deg: "68.151802062988",
      longitude_deg: "33.463901519775",
      elevation_ft: 702,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-MUR",
      municipality: "Olenegorsk",
      iata_code: ""
    },
    {
      name: "Jorge Newbery Airpark",
      latitude_deg: "-34.5592",
      longitude_deg: "-58.4156",
      elevation_ft: 18,
      continent: "SA",
      iso_country: "AR",
      iso_region: "AR-C",
      municipality: "Buenos Aires",
      iata_code: "AEP"
    },
    {
      name: "Ministro Pistarini International Airport",
      latitude_deg: "-34.8222",
      longitude_deg: "-58.5358",
      elevation_ft: 67,
      continent: "SA",
      iso_country: "AR",
      iso_region: "AR-B",
      municipality: "Buenos Aires (Ezeiza)",
      iata_code: "EZE"
    },
    {
      name: "Val de Cans/Júlio Cezar Ribeiro International Airport",
      latitude_deg: "-1.379279",
      longitude_deg: "-48.476207",
      elevation_ft: 54,
      continent: "SA",
      iso_country: "BR",
      iso_region: "BR-PA",
      municipality: "Belém",
      iata_code: "BEL"
    },
    {
      name: "Presidente Juscelino Kubitschek International Airport",
      latitude_deg: "-15.869167",
      longitude_deg: "-47.920834",
      elevation_ft: 3497,
      continent: "SA",
      iso_country: "BR",
      iso_region: "BR-DF",
      municipality: "Brasília",
      iata_code: "BSB"
    },
    {
      name: "Tancredo Neves International Airport",
      latitude_deg: "-19.63571",
      longitude_deg: "-43.966928",
      elevation_ft: 2721,
      continent: "SA",
      iso_country: "BR",
      iso_region: "BR-MG",
      municipality: "Belo Horizonte",
      iata_code: "CNF"
    },
    {
      name: "Eduardo Gomes International Airport",
      latitude_deg: "-3.03861",
      longitude_deg: "-60.049702",
      elevation_ft: 264,
      continent: "SA",
      iso_country: "BR",
      iso_region: "BR-AM",
      municipality: "Manaus",
      iata_code: "MAO"
    },
    {
      name: "Hercílio Luz International Airport",
      latitude_deg: "-27.670279",
      longitude_deg: "-48.552502",
      elevation_ft: 16,
      continent: "SA",
      iso_country: "BR",
      iso_region: "BR-SC",
      municipality: "Florianópolis",
      iata_code: "FLN"
    },
    {
      name: "Rio Galeão – Tom Jobim International Airport",
      latitude_deg: "-22.809999",
      longitude_deg: "-43.250557",
      elevation_ft: 28,
      continent: "SA",
      iso_country: "BR",
      iso_region: "BR-RJ",
      municipality: "Rio De Janeiro",
      iata_code: "GIG"
    },
    {
      name: "Guarulhos - Governador André Franco Montoro International Airport",
      latitude_deg: "-23.431944",
      longitude_deg: "-46.467778",
      elevation_ft: 2461,
      continent: "SA",
      iso_country: "BR",
      iso_region: "BR-SP",
      municipality: "São Paulo",
      iata_code: "GRU"
    },
    {
      name: "Deputado Luiz Eduardo Magalhães International Airport",
      latitude_deg: "-12.908611",
      longitude_deg: "-38.322498",
      elevation_ft: 64,
      continent: "SA",
      iso_country: "BR",
      iso_region: "BR-BA",
      municipality: "Salvador",
      iata_code: "SSA"
    },
    {
      name: "Comodoro Arturo Merino Benítez International Airport",
      latitude_deg: "-33.3930015563965",
      longitude_deg: "-70.7857971191406",
      elevation_ft: 1555,
      continent: "SA",
      iso_country: "CL",
      iso_region: "CL-RM",
      municipality: "Santiago",
      iata_code: "SCL"
    },
    {
      name: "José Joaquín de Olmedo International Airport",
      latitude_deg: "-2.15742",
      longitude_deg: "-79.883598",
      elevation_ft: 19,
      continent: "SA",
      iso_country: "EC",
      iso_region: "EC-G",
      municipality: "Guayaquil",
      iata_code: "GYE"
    },
    {
      name: "Mariscal Sucre International Airport",
      latitude_deg: "-0.129166666667",
      longitude_deg: "-78.3575",
      elevation_ft: 7841,
      continent: "SA",
      iso_country: "EC",
      iso_region: "EC-P",
      municipality: "Quito",
      iata_code: "UIO"
    },
    {
      name: "El Dorado International Airport",
      latitude_deg: "4.70159",
      longitude_deg: "-74.1469",
      elevation_ft: 8361,
      continent: "SA",
      iso_country: "CO",
      iso_region: "CO-CUN",
      municipality: "Bogota",
      iata_code: "BOG"
    },
    {
      name: "Viru Viru International Airport",
      latitude_deg: "-17.6448",
      longitude_deg: "-63.135399",
      elevation_ft: 1224,
      continent: "SA",
      iso_country: "BO",
      iso_region: "BO-S",
      municipality: "Santa Cruz",
      iata_code: "VVI"
    },
    {
      name: "Johan Adolf Pengel International Airport",
      latitude_deg: "5.45283",
      longitude_deg: "-55.187801",
      elevation_ft: 59,
      continent: "SA",
      iso_country: "SR",
      iso_region: "SR-PR",
      municipality: "Zandery",
      iata_code: "PBM"
    },
    {
      name: "Cayenne – Félix Eboué Airport",
      latitude_deg: "4.819964",
      longitude_deg: "-52.361326",
      elevation_ft: 26,
      continent: "SA",
      iso_country: "GF",
      iso_region: "GF-CY",
      municipality: "Matoury",
      iata_code: "CAY"
    },
    {
      name: "Jorge Chávez International Airport",
      latitude_deg: "-12.0219",
      longitude_deg: "-77.114305",
      elevation_ft: 113,
      continent: "SA",
      iso_country: "PE",
      iso_region: "PE-LIM",
      municipality: "Lima",
      iata_code: "LIM"
    },
    {
      name: "Alejandro Velasco Astete International Airport",
      latitude_deg: "-13.5356998444",
      longitude_deg: "-71.9387969971",
      elevation_ft: 10860,
      continent: "SA",
      iso_country: "PE",
      iso_region: "PE-CUS",
      municipality: "Cusco",
      iata_code: "CUZ"
    },
    {
      name: "Carrasco International /General C L Berisso Airport",
      latitude_deg: "-34.838402",
      longitude_deg: "-56.0308",
      elevation_ft: 105,
      continent: "SA",
      iso_country: "UY",
      iso_region: "UY-CA",
      municipality: "Montevideo",
      iata_code: "MVD"
    },
    {
      name: "General José Antonio Anzoategui International Airport",
      latitude_deg: "10.111111",
      longitude_deg: "-64.692222",
      elevation_ft: 30,
      continent: "SA",
      iso_country: "VE",
      iso_region: "VE-B",
      municipality: "Barcelona",
      iata_code: "BLA"
    },
    {
      name: "Simón Bolívar International Airport",
      latitude_deg: "10.601194",
      longitude_deg: "-66.991222",
      elevation_ft: 234,
      continent: "SA",
      iso_country: "VE",
      iso_region: "VE-X",
      municipality: "Caracas",
      iata_code: "CCS"
    },
    {
      name: "Qingdao Jiaodong International Airport",
      latitude_deg: "36.361953",
      longitude_deg: "120.088171",
      elevation_ft: 30,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-37",
      municipality: "Jiaozhou, Qingdao",
      iata_code: "TAO"
    },
    {
      name: "Martinique Aimé Césaire International Airport",
      latitude_deg: "14.591",
      longitude_deg: "-61.003201",
      elevation_ft: 16,
      continent: "NA",
      iso_country: "MQ",
      iso_region: "MQ-U-A",
      municipality: "Fort-de-France",
      iata_code: "FDF"
    },
    {
      name: "Pointe-à-Pitre Le Raizet International  Airport",
      latitude_deg: "16.265301",
      longitude_deg: "-61.531799",
      elevation_ft: 36,
      continent: "NA",
      iso_country: "GP",
      iso_region: "GP-U-A",
      municipality: "Pointe-à-Pitre",
      iata_code: "PTP"
    },
    {
      name: "Luis Munoz Marin International Airport",
      latitude_deg: "18.4393997192",
      longitude_deg: "-66.0018005371",
      elevation_ft: 9,
      continent: "NA",
      iso_country: "PR",
      iso_region: "PR-U-A",
      municipality: "San Juan",
      iata_code: "SJU"
    },
    {
      name: "Hewanorra International Airport",
      latitude_deg: "13.7332",
      longitude_deg: "-60.952599",
      elevation_ft: 14,
      continent: "NA",
      iso_country: "LC",
      iso_region: "LC-11",
      municipality: "Vieux Fort",
      iata_code: "UVF"
    },
    {
      name: "Queen Beatrix International Airport",
      latitude_deg: "12.5014",
      longitude_deg: "-70.015198",
      elevation_ft: 60,
      continent: "NA",
      iso_country: "AW",
      iso_region: "AW-U-A",
      municipality: "Oranjestad",
      iata_code: "AUA"
    },
    {
      name: "Flamingo International Airport",
      latitude_deg: "12.131",
      longitude_deg: "-68.268501",
      elevation_ft: 20,
      continent: "NA",
      iso_country: "BQ",
      iso_region: "BQ-U-A",
      municipality: "Kralendijk, Bonaire",
      iata_code: "BON"
    },
    {
      name: "Hato International Airport",
      latitude_deg: "12.1889",
      longitude_deg: "-68.959801",
      elevation_ft: 29,
      continent: "NA",
      iso_country: "CW",
      iso_region: "CW-U-A",
      municipality: "Willemstad",
      iata_code: "CUR"
    },
    {
      name: "Princess Juliana International Airport",
      latitude_deg: "18.041",
      longitude_deg: "-63.108898",
      elevation_ft: 13,
      continent: "NA",
      iso_country: "SX",
      iso_region: "SX-U-A",
      municipality: "Saint Martin",
      iata_code: "SXM"
    },
    {
      name: "Almaty International Airport",
      latitude_deg: "43.3521",
      longitude_deg: "77.040497",
      elevation_ft: 2234,
      continent: "AS",
      iso_country: "KZ",
      iso_region: "KZ-ALM",
      municipality: "Almaty",
      iata_code: "ALA"
    },
    {
      name: "Nursultan Nazarbayev International Airport",
      latitude_deg: "51.022202",
      longitude_deg: "71.466904",
      elevation_ft: 1165,
      continent: "AS",
      iso_country: "KZ",
      iso_region: "KZ-AKM",
      municipality: "Nur-Sultan",
      iata_code: "NQZ"
    },
    {
      name: "Manas International Airport",
      latitude_deg: "43.0612983704",
      longitude_deg: "74.4776000977",
      elevation_ft: 2058,
      continent: "AS",
      iso_country: "KG",
      iso_region: "KG-C",
      municipality: "Bishkek",
      iata_code: "FRU"
    },
    {
      name: "Hazrat Sultan International Airport",
      latitude_deg: "43.313126",
      longitude_deg: "68.549881",
      elevation_ft: 1,
      continent: "AS",
      iso_country: "KZ",
      iso_region: "KZ-YUZ",
      municipality: "",
      iata_code: "HSA"
    },
    {
      name: "Heydar Aliyev International Airport",
      latitude_deg: "40.4674987792969",
      longitude_deg: "50.0466995239258",
      elevation_ft: 10,
      continent: "AS",
      iso_country: "AZ",
      iso_region: "AZ-BA",
      municipality: "Baku",
      iata_code: "GYD"
    },
    {
      name: "Zvartnots International Airport",
      latitude_deg: "40.1473007202",
      longitude_deg: "44.3959007263",
      elevation_ft: 2838,
      continent: "AS",
      iso_country: "AM",
      iso_region: "AM-ER",
      municipality: "Yerevan",
      iata_code: "EVN"
    },
    {
      name: "Tbilisi International Airport",
      latitude_deg: "41.6692008972",
      longitude_deg: "44.95470047",
      elevation_ft: 1624,
      continent: "AS",
      iso_country: "GE",
      iso_region: "GE-TB",
      municipality: "Tbilisi",
      iata_code: "TBS"
    },
    {
      name: "Vladivostok International Airport",
      latitude_deg: "43.396256",
      longitude_deg: "132.148155",
      elevation_ft: 59,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-PRI",
      municipality: "Artyom",
      iata_code: "VVO"
    },
    {
      name: "Boryspil International Airport",
      latitude_deg: "50.3450012207031",
      longitude_deg: "30.8946990966797",
      elevation_ft: 427,
      continent: "EU",
      iso_country: "UA",
      iso_region: "UA-32",
      municipality: "Kiev",
      iata_code: "KBP"
    },
    {
      name: "Lviv International Airport",
      latitude_deg: "49.8125",
      longitude_deg: "23.9561",
      elevation_ft: 1071,
      continent: "EU",
      iso_country: "UA",
      iso_region: "UA-46",
      municipality: "Lviv",
      iata_code: "LWO"
    },
    {
      name: "Pulkovo Airport",
      latitude_deg: "59.8003005981445",
      longitude_deg: "30.2625007629395",
      elevation_ft: 78,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-SPE",
      municipality: "St. Petersburg",
      iata_code: "LED"
    },
    {
      name: "Minsk National Airport",
      latitude_deg: "53.888071",
      longitude_deg: "28.039964",
      elevation_ft: 670,
      continent: "EU",
      iso_country: "BY",
      iso_region: "BY-MI",
      municipality: "Minsk",
      iata_code: "MSQ"
    },
    {
      name: "Krasnoyarsk International Airport",
      latitude_deg: "56.173077",
      longitude_deg: "92.492437",
      elevation_ft: 942,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-KYA",
      municipality: "Krasnoyarsk",
      iata_code: "KJA"
    },
    {
      name: "Novosibirsk Tolmachevo Airport",
      latitude_deg: "55.019756",
      longitude_deg: "82.618675",
      elevation_ft: 365,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-NVS",
      municipality: "Novosibirsk",
      iata_code: "OVB"
    },
    {
      name: "Platov International Airport",
      latitude_deg: "47.493888",
      longitude_deg: "39.924722",
      elevation_ft: 213,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-ROS",
      municipality: "Rostov-on-Don",
      iata_code: "ROV"
    },
    {
      name: "Sochi International Airport",
      latitude_deg: "43.449902",
      longitude_deg: "39.9566",
      elevation_ft: 89,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-KDA",
      municipality: "Sochi",
      iata_code: "AER"
    },
    {
      name: "CLICK HERE TO APPLY FOR URGENT LOAN",
      latitude_deg: "42.287191",
      longitude_deg: "68.90625",
      elevation_ft: null,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-KS",
      municipality: "",
      iata_code: ""
    },
    {
      name: "CLICK HERE TO APPLY FOR URGENT LOAN",
      latitude_deg: "42.287191",
      longitude_deg: "68.90625",
      elevation_ft: null,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-KS",
      municipality: "",
      iata_code: ""
    },
    {
      name: "CLICK HERE TO APPLY FOR URGENT LOAN",
      latitude_deg: "42.287191",
      longitude_deg: "68.90625",
      elevation_ft: null,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-KS",
      municipality: "",
      iata_code: ""
    },
    {
      name: "CLICK HERE TO APPLY FOR URGENT LOAN",
      latitude_deg: "42.287191",
      longitude_deg: "68.90625",
      elevation_ft: null,
      continent: "NA",
      iso_country: "US",
      iso_region: "US-KS",
      municipality: "",
      iata_code: ""
    },
    {
      name: "Koltsovo Airport",
      latitude_deg: "56.743099212646",
      longitude_deg: "60.802700042725",
      elevation_ft: 764,
      continent: "AS",
      iso_country: "RU",
      iso_region: "RU-SVE",
      municipality: "Yekaterinburg",
      iata_code: "SVX"
    },
    {
      name: "Ashgabat International Airport",
      latitude_deg: "37.986801",
      longitude_deg: "58.361",
      elevation_ft: 692,
      continent: "AS",
      iso_country: "TM",
      iso_region: "TM-A",
      municipality: "Ashgabat",
      iata_code: "ASB"
    },
    {
      name: "Tashkent International Airport",
      latitude_deg: "41.257900238",
      longitude_deg: "69.2811965942",
      elevation_ft: 1417,
      continent: "AS",
      iso_country: "UZ",
      iso_region: "UZ-TO",
      municipality: "Tashkent",
      iata_code: "TAS"
    },
    {
      name: "Zhukovsky International Airport",
      latitude_deg: "55.553299",
      longitude_deg: "38.150002",
      elevation_ft: 377,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-MOS",
      municipality: "Moscow",
      iata_code: "ZIA"
    },
    {
      name: "Domodedovo International Airport",
      latitude_deg: "55.4087982177734",
      longitude_deg: "37.9062995910645",
      elevation_ft: 588,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-MOS",
      municipality: "Moscow",
      iata_code: "DME"
    },
    {
      name: "Sheremetyevo International Airport",
      latitude_deg: "55.972599",
      longitude_deg: "37.4146",
      elevation_ft: 622,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-MOS",
      municipality: "Moscow",
      iata_code: "SVO"
    },
    {
      name: "Vnukovo International Airport",
      latitude_deg: "55.5914993286",
      longitude_deg: "37.2615013123",
      elevation_ft: 685,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-MOS",
      municipality: "Moscow",
      iata_code: "VKO"
    },
    {
      name: "Kazan International Airport",
      latitude_deg: "55.606201171875",
      longitude_deg: "49.278701782227",
      elevation_ft: 411,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-TA",
      municipality: "Kazan",
      iata_code: "KZN"
    },
    {
      name: "Gagarin International Airport",
      latitude_deg: "51.712778",
      longitude_deg: "46.171111",
      elevation_ft: 103,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-SAR",
      municipality: "Saratov",
      iata_code: "GSV"
    },
    {
      name: "Ufa International Airport",
      latitude_deg: "54.557498931885",
      longitude_deg: "55.874401092529",
      elevation_ft: 449,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-BA",
      municipality: "Ufa",
      iata_code: "UFA"
    },
    {
      name: "Kurumoch International Airport",
      latitude_deg: "53.504901885986",
      longitude_deg: "50.16429901123",
      elevation_ft: 477,
      continent: "EU",
      iso_country: "RU",
      iso_region: "RU-SAM",
      municipality: "Samara",
      iata_code: "KUF"
    },
    {
      name: "Chhatrapati Shivaji International Airport",
      latitude_deg: "19.0886993408",
      longitude_deg: "72.8678970337",
      elevation_ft: 39,
      continent: "AS",
      iso_country: "IN",
      iso_region: "IN-MM",
      municipality: "Mumbai",
      iata_code: "BOM"
    },
    {
      name: "Dabolim Airport",
      latitude_deg: "15.3808002472",
      longitude_deg: "73.8313980103",
      elevation_ft: 150,
      continent: "AS",
      iso_country: "IN",
      iso_region: "IN-GA",
      municipality: "Vasco da Gama",
      iata_code: "GOI"
    },
    {
      name: "Bandaranaike International Colombo Airport",
      latitude_deg: "7.1807599067688",
      longitude_deg: "79.8841018676758",
      elevation_ft: 30,
      continent: "AS",
      iso_country: "LK",
      iso_region: "LK-1",
      municipality: "Colombo",
      iata_code: "CMB"
    },
    {
      name: "Mattala Rajapaksa International Airport",
      latitude_deg: "6.284467",
      longitude_deg: "81.124128",
      elevation_ft: 157,
      continent: "AS",
      iso_country: "LK",
      iso_region: "LK-3",
      municipality: "",
      iata_code: "HRI"
    },
    {
      name: "Phnom Penh International Airport",
      latitude_deg: "11.5466",
      longitude_deg: "104.844002",
      elevation_ft: 40,
      continent: "AS",
      iso_country: "KH",
      iso_region: "KH-12",
      municipality: "Phnom Penh (Pou Senchey)",
      iata_code: "PNH"
    },
    {
      name: "Siem Reap International Airport",
      latitude_deg: "13.41155",
      longitude_deg: "103.813044",
      elevation_ft: 60,
      continent: "AS",
      iso_country: "KH",
      iso_region: "KH-17",
      municipality: "Siem Reap",
      iata_code: "REP"
    },
    {
      name: "Netaji Subhash Chandra Bose International Airport",
      latitude_deg: "22.6546993255615",
      longitude_deg: "88.4467010498047",
      elevation_ft: 16,
      continent: "AS",
      iso_country: "IN",
      iso_region: "IN-WB",
      municipality: "Kolkata",
      iata_code: "CCU"
    },
    {
      name: "Hazrat Shahjalal International Airport",
      latitude_deg: "23.843347",
      longitude_deg: "90.397783",
      elevation_ft: 30,
      continent: "AS",
      iso_country: "BD",
      iso_region: "BD-3",
      municipality: "Dhaka",
      iata_code: "DAC"
    },
    {
      name: "Hong Kong International Airport",
      latitude_deg: "22.308901",
      longitude_deg: "113.915001",
      elevation_ft: 28,
      continent: "AS",
      iso_country: "HK",
      iso_region: "HK-U-A",
      municipality: "Hong Kong",
      iata_code: "HKG"
    },
    {
      name: "Indira Gandhi International Airport",
      latitude_deg: "28.55563",
      longitude_deg: "77.09519",
      elevation_ft: 777,
      continent: "AS",
      iso_country: "IN",
      iso_region: "IN-DL",
      municipality: "New Delhi",
      iata_code: "DEL"
    },
    {
      name: "Macau International Airport",
      latitude_deg: "22.149599",
      longitude_deg: "113.592003",
      elevation_ft: 20,
      continent: "AS",
      iso_country: "MO",
      iso_region: "MO-U-A",
      municipality: "Freguesia de Nossa Senhora do Carmo (Taipa)",
      iata_code: "MFM"
    },
    {
      name: "Tribhuvan International Airport",
      latitude_deg: "27.6966",
      longitude_deg: "85.3591",
      elevation_ft: 4390,
      continent: "AS",
      iso_country: "NP",
      iso_region: "NP-BA",
      municipality: "Kathmandu",
      iata_code: "KTM"
    },
    {
      name: "Kempegowda International Airport",
      latitude_deg: "13.1979",
      longitude_deg: "77.706299",
      elevation_ft: 3000,
      continent: "AS",
      iso_country: "IN",
      iso_region: "IN-KA",
      municipality: "Bangalore",
      iata_code: "BLR"
    },
    {
      name: "Cochin International Airport",
      latitude_deg: "10.152",
      longitude_deg: "76.401901",
      elevation_ft: 30,
      continent: "AS",
      iso_country: "IN",
      iso_region: "IN-KL",
      municipality: "Kochi",
      iata_code: "COK"
    },
    {
      name: "Rajiv Gandhi International Airport",
      latitude_deg: "17.231318",
      longitude_deg: "78.429855",
      elevation_ft: 2024,
      continent: "AS",
      iso_country: "IN",
      iso_region: "IN-TG",
      municipality: "Hyderabad",
      iata_code: "HYD"
    },
    {
      name: "Chennai International Airport",
      latitude_deg: "12.990005",
      longitude_deg: "80.169296",
      elevation_ft: 52,
      continent: "AS",
      iso_country: "IN",
      iso_region: "IN-TN",
      municipality: "Chennai",
      iata_code: "MAA"
    },
    {
      name: "Trivandrum International Airport",
      latitude_deg: "8.48211956024",
      longitude_deg: "76.9200973511",
      elevation_ft: 15,
      continent: "AS",
      iso_country: "IN",
      iso_region: "IN-KL",
      municipality: "Thiruvananthapuram",
      iata_code: "TRV"
    },
    {
      name: "Malé International Airport",
      latitude_deg: "4.19183015823364",
      longitude_deg: "73.5290985107422",
      elevation_ft: 6,
      continent: "AS",
      iso_country: "MV",
      iso_region: "MV-MLE",
      municipality: "Malé",
      iata_code: "MLE"
    },
    {
      name: "Don Mueang International Airport",
      latitude_deg: "13.9125995636",
      longitude_deg: "100.607002258",
      elevation_ft: 9,
      continent: "AS",
      iso_country: "TH",
      iso_region: "TH-10",
      municipality: "Bangkok",
      iata_code: "DMK"
    },
    {
      name: "Suvarnabhumi Airport",
      latitude_deg: "13.6810998916626",
      longitude_deg: "100.747001647949",
      elevation_ft: 5,
      continent: "AS",
      iso_country: "TH",
      iso_region: "TH-10",
      municipality: "Bangkok",
      iata_code: "BKK"
    },
    {
      name: "Chiang Mai International Airport",
      latitude_deg: "18.7667999268",
      longitude_deg: "98.962600708",
      elevation_ft: 1036,
      continent: "AS",
      iso_country: "TH",
      iso_region: "TH-50",
      municipality: "Chiang Mai",
      iata_code: "CNX"
    },
    {
      name: "Phuket International Airport",
      latitude_deg: "8.1132",
      longitude_deg: "98.316902",
      elevation_ft: 82,
      continent: "AS",
      iso_country: "TH",
      iso_region: "TH-83",
      municipality: "Phuket",
      iata_code: "HKT"
    },
    {
      name: "Noi Bai International Airport",
      latitude_deg: "21.221201",
      longitude_deg: "105.806999",
      elevation_ft: 39,
      continent: "AS",
      iso_country: "VN",
      iso_region: "VN-RRD",
      municipality: "Soc Son, Hanoi",
      iata_code: "HAN"
    },
    {
      name: "Tan Son Nhat International Airport",
      latitude_deg: "10.8188",
      longitude_deg: "106.652",
      elevation_ft: 33,
      continent: "AS",
      iso_country: "VN",
      iso_region: "VN-SE",
      municipality: "Ho Chi Minh City",
      iata_code: "SGN"
    },
    {
      name: "Mandalay International Airport",
      latitude_deg: "21.7021999359131",
      longitude_deg: "95.977897644043",
      elevation_ft: 300,
      continent: "AS",
      iso_country: "MM",
      iso_region: "MM-04",
      municipality: "Mandalay",
      iata_code: "MDL"
    },
    {
      name: "Yangon International Airport",
      latitude_deg: "16.9073009491",
      longitude_deg: "96.1332015991",
      elevation_ft: 109,
      continent: "AS",
      iso_country: "MM",
      iso_region: "MM-06",
      municipality: "Yangon",
      iata_code: "RGN"
    },
    {
      name: "Hasanuddin International Airport",
      latitude_deg: "-5.06162977218628",
      longitude_deg: "119.554000854492",
      elevation_ft: 47,
      continent: "AS",
      iso_country: "ID",
      iso_region: "ID-SN",
      municipality: "Ujung Pandang-Celebes Island",
      iata_code: "UPG"
    },
    {
      name: "Ngurah Rai (Bali) International Airport",
      latitude_deg: "-8.7481698989868",
      longitude_deg: "115.16699981689",
      elevation_ft: 14,
      continent: "AS",
      iso_country: "ID",
      iso_region: "ID-BA",
      municipality: "Denpasar-Bali Island",
      iata_code: "DPS"
    },
    {
      name: "Sentani International Airport",
      latitude_deg: "-2.57695",
      longitude_deg: "140.516006",
      elevation_ft: 289,
      continent: "AS",
      iso_country: "ID",
      iso_region: "ID-PA",
      municipality: "Jayapura-Papua Island",
      iata_code: "DJJ"
    },
    {
      name: "Juanda International Airport",
      latitude_deg: "-7.37982988357544",
      longitude_deg: "112.787002563477",
      elevation_ft: 9,
      continent: "AS",
      iso_country: "ID",
      iso_region: "ID-JI",
      municipality: "Surabaya",
      iata_code: "SUB"
    },
    {
      name: "Brunei International Airport",
      latitude_deg: "4.94420003890991",
      longitude_deg: "114.928001403809",
      elevation_ft: 73,
      continent: "AS",
      iso_country: "BN",
      iso_region: "BN-BM",
      municipality: "Bandar Seri Begawan",
      iata_code: "BWN"
    },
    {
      name: "Soekarno-Hatta International Airport",
      latitude_deg: "-6.1255698204",
      longitude_deg: "106.65599823",
      elevation_ft: 34,
      continent: "AS",
      iso_country: "ID",
      iso_region: "ID-BT",
      municipality: "Jakarta",
      iata_code: "CGK"
    },
    {
      name: "Kuala Lumpur International Airport",
      latitude_deg: "2.745579957962",
      longitude_deg: "101.70999908447",
      elevation_ft: 69,
      continent: "AS",
      iso_country: "MY",
      iso_region: "MY-14",
      municipality: "Kuala Lumpur",
      iata_code: "KUL"
    },
    {
      name: "Singapore Changi Airport",
      latitude_deg: "1.35019",
      longitude_deg: "103.994003",
      elevation_ft: 22,
      continent: "AS",
      iso_country: "SG",
      iso_region: "SG-04",
      municipality: "Singapore",
      iata_code: "SIN"
    },
    {
      name: "Brisbane International Airport",
      latitude_deg: "-27.3841991424561",
      longitude_deg: "153.117004394531",
      elevation_ft: 13,
      continent: "OC",
      iso_country: "AU",
      iso_region: "AU-QLD",
      municipality: "Brisbane",
      iata_code: "BNE"
    },
    {
      name: "Melbourne International Airport",
      latitude_deg: "-37.673302",
      longitude_deg: "144.843002",
      elevation_ft: 434,
      continent: "OC",
      iso_country: "AU",
      iso_region: "AU-VIC",
      municipality: "Melbourne",
      iata_code: "MEL"
    },
    {
      name: "Yantai Penglai International Airport",
      latitude_deg: "37.659724",
      longitude_deg: "120.978124",
      elevation_ft: 154,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-37",
      municipality: "Yantai",
      iata_code: "YNT"
    },
    {
      name: "Adelaide International Airport",
      latitude_deg: "-34.947512",
      longitude_deg: "138.533393",
      elevation_ft: 20,
      continent: "OC",
      iso_country: "AU",
      iso_region: "AU-SA",
      municipality: "Adelaide",
      iata_code: "ADL"
    },
    {
      name: "Perth International Airport",
      latitude_deg: "-31.940299987793",
      longitude_deg: "115.967002868652",
      elevation_ft: 67,
      continent: "OC",
      iso_country: "AU",
      iso_region: "AU-WA",
      municipality: "Perth",
      iata_code: "PER"
    },
    {
      name: "Sydney Kingsford Smith International Airport",
      latitude_deg: "-33.9460983276367",
      longitude_deg: "151.177001953125",
      elevation_ft: 21,
      continent: "OC",
      iso_country: "AU",
      iso_region: "AU-NSW",
      municipality: "Sydney",
      iata_code: "SYD"
    },
    {
      name: "Beijing Capital International Airport",
      latitude_deg: "40.0801010131836",
      longitude_deg: "116.584999084473",
      elevation_ft: 116,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-11",
      municipality: "Beijing",
      iata_code: "PEK"
    },
    {
      name: "Beijing Daxing International Airport",
      latitude_deg: "39.509945",
      longitude_deg: "116.41092",
      elevation_ft: 98,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-11",
      municipality: "Beijing",
      iata_code: "PKX"
    },
    {
      name: "Baita International Airport",
      latitude_deg: "40.851398",
      longitude_deg: "111.823997",
      elevation_ft: 3556,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-15",
      municipality: "Hohhot",
      iata_code: "HET"
    },
    {
      name: "Tianjin Binhai International Airport",
      latitude_deg: "39.1244010925",
      longitude_deg: "117.346000671",
      elevation_ft: 10,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-12",
      municipality: "Tianjin",
      iata_code: "TSN"
    },
    {
      name: "Taiyuan Wusu Airport",
      latitude_deg: "37.746899",
      longitude_deg: "112.627998",
      elevation_ft: 2575,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-14",
      municipality: "Taiyuan",
      iata_code: "TYN"
    },
    {
      name: "Guangzhou Baiyun International Airport",
      latitude_deg: "23.392401",
      longitude_deg: "113.299004",
      elevation_ft: 50,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-44",
      municipality: "Guangzhou (Huadu)",
      iata_code: "CAN"
    },
    {
      name: "Changsha Huanghua International Airport",
      latitude_deg: "28.1891994476",
      longitude_deg: "113.220001221",
      elevation_ft: 217,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-43",
      municipality: "Changsha",
      iata_code: "CSX"
    },
    {
      name: "Guilin Liangjiang International Airport",
      latitude_deg: "25.219828",
      longitude_deg: "110.039553",
      elevation_ft: 570,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-45",
      municipality: "Guilin (Lingui)",
      iata_code: "KWL"
    },
    {
      name: "Nanning Wuxu Airport",
      latitude_deg: "22.608299",
      longitude_deg: "108.171997",
      elevation_ft: 421,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-45",
      municipality: "Nanning (Jiangnan)",
      iata_code: "NNG"
    },
    {
      name: "Shenzhen Bao'an International Airport",
      latitude_deg: "22.639299",
      longitude_deg: "113.810997",
      elevation_ft: 13,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-44",
      municipality: "Shenzhen (Bao'an)",
      iata_code: "SZX"
    },
    {
      name: "Zhengzhou Xinzheng International Airport",
      latitude_deg: "34.526497",
      longitude_deg: "113.849165",
      elevation_ft: 495,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-41",
      municipality: "Zhengzhou",
      iata_code: "CGO"
    },
    {
      name: "Wuhan Tianhe International Airport",
      latitude_deg: "30.774798",
      longitude_deg: "114.213723",
      elevation_ft: 113,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-42",
      municipality: "Wuhan",
      iata_code: "WUH"
    },
    {
      name: "Haikou Meilan International Airport",
      latitude_deg: "19.9349",
      longitude_deg: "110.459",
      elevation_ft: 75,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-46",
      municipality: "Haikou (Meilan)",
      iata_code: "HAK"
    },
    {
      name: "Sanya Phoenix International Airport",
      latitude_deg: "18.3029",
      longitude_deg: "109.412003",
      elevation_ft: 92,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-46",
      municipality: "Sanya (Tianya)",
      iata_code: "SYX"
    },
    {
      name: "Lanzhou Zhongchuan International Airport",
      latitude_deg: "36.515202",
      longitude_deg: "103.620003",
      elevation_ft: 6388,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-62",
      municipality: "Lanzhou",
      iata_code: "LHW"
    },
    {
      name: "Xi'an Xianyang International Airport",
      latitude_deg: "34.447102",
      longitude_deg: "108.751999",
      elevation_ft: 1572,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-61",
      municipality: "Xi'an",
      iata_code: "XIY"
    },
    {
      name: "Ulaanbaatar Chinggis Khaan International Airport",
      latitude_deg: "47.646916",
      longitude_deg: "106.819833",
      elevation_ft: 4482,
      continent: "AS",
      iso_country: "MN",
      iso_region: "MN-047",
      municipality: "Ulaanbaatar (Sergelen)",
      iata_code: "UBN"
    },
    {
      name: "Kunming Changshui International Airport",
      latitude_deg: "25.1019444",
      longitude_deg: "102.9291667",
      elevation_ft: 6903,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-53",
      municipality: "Kunming",
      iata_code: "KMG"
    },
    {
      name: "Xiamen Gaoqi International Airport",
      latitude_deg: "24.5440006256104",
      longitude_deg: "118.127998352051",
      elevation_ft: 59,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-35",
      municipality: "Xiamen",
      iata_code: "XMN"
    },
    {
      name: "Fuzhou Changle International Airport",
      latitude_deg: "25.934669",
      longitude_deg: "119.66318",
      elevation_ft: 46,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-35",
      municipality: "Fuzhou",
      iata_code: "FOC"
    },
    {
      name: "Hangzhou Xiaoshan International Airport",
      latitude_deg: "30.23609",
      longitude_deg: "120.428865",
      elevation_ft: 23,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-33",
      municipality: "Hangzhou",
      iata_code: "HGH"
    },
    {
      name: "Jinan Yaoqiang International Airport",
      latitude_deg: "36.857201",
      longitude_deg: "117.216003",
      elevation_ft: 76,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-37",
      municipality: "Jinan",
      iata_code: "TNA"
    },
    {
      name: "Ningbo Lishe International Airport",
      latitude_deg: "29.8267002105713",
      longitude_deg: "121.46199798584",
      elevation_ft: 13,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-33",
      municipality: "Ningbo",
      iata_code: "NGB"
    },
    {
      name: "Nanjing Lukou International Airport",
      latitude_deg: "31.735032",
      longitude_deg: "118.865949",
      elevation_ft: 49,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-32",
      municipality: "Nanjing",
      iata_code: "NKG"
    },
    {
      name: "Shanghai Pudong International Airport",
      latitude_deg: "31.1434",
      longitude_deg: "121.805",
      elevation_ft: 13,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-31",
      municipality: "Shanghai (Pudong)",
      iata_code: "PVG"
    },
    {
      name: "Shanghai Hongqiao International Airport",
      latitude_deg: "31.198104",
      longitude_deg: "121.33426",
      elevation_ft: 10,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-31",
      municipality: "Shanghai (Minhang)",
      iata_code: "SHA"
    },
    {
      name: "Wenzhou Longwan International Airport",
      latitude_deg: "27.912201",
      longitude_deg: "120.851997",
      elevation_ft: null,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-33",
      municipality: "Wenzhou",
      iata_code: "WNZ"
    },
    {
      name: "Chongqing Jiangbei International Airport",
      latitude_deg: "29.712254",
      longitude_deg: "106.651895",
      elevation_ft: 1365,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-50",
      municipality: "Chongqing",
      iata_code: "CKG"
    },
    {
      name: "Longdongbao Airport",
      latitude_deg: "26.5384998321533",
      longitude_deg: "106.801002502441",
      elevation_ft: 3736,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-52",
      municipality: "Guiyang",
      iata_code: "KWE"
    },
    {
      name: "Chengdu Tianfu International Airport",
      latitude_deg: "30.31252",
      longitude_deg: "104.441284",
      elevation_ft: 1440,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-51",
      municipality: "Jianyang, Chengdu",
      iata_code: "TFU"
    },
    {
      name: "Chengdu Shuangliu International Airport",
      latitude_deg: "30.558257",
      longitude_deg: "103.945966",
      elevation_ft: 1625,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-51",
      municipality: "Chengdu",
      iata_code: "CTU"
    },
    {
      name: "Ürümqi Diwopu International Airport",
      latitude_deg: "43.9071006774902",
      longitude_deg: "87.4741973876953",
      elevation_ft: 2125,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-65",
      municipality: "Ürümqi",
      iata_code: "URC"
    },
    {
      name: "Harbin Taiping International Airport",
      latitude_deg: "45.623402",
      longitude_deg: "126.25",
      elevation_ft: 457,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-23",
      municipality: "Harbin",
      iata_code: "HRB"
    },
    {
      name: "Dalian Zhoushuizi International Airport",
      latitude_deg: "38.965698",
      longitude_deg: "121.539001",
      elevation_ft: 107,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-21",
      municipality: "Ganjingzi, Dalian",
      iata_code: "DLC"
    },
    {
      name: "Shenyang Taoxian International Airport",
      latitude_deg: "41.639801",
      longitude_deg: "123.483002",
      elevation_ft: 198,
      continent: "AS",
      iso_country: "CN",
      iso_region: "CN-21",
      municipality: "Hunnan, Shenyang",
      iata_code: "SHE"
    }
  ];

  console.log("data: ", airports)

  let airportsList = airports.map(value => {
    return value.name +
      ", " + value.municipality +
      ", " + value.iso_country +
      ", " + value.iata_code
  });

  // console.log("ItemName: ", airportsList)

  $(".airports").autocomplete({
    source: airportsList
  });
});

/**
 * Main entry point.
 */
window.addEventListener('load', async () => {
  init();
  document.querySelector("#btn-connect").addEventListener("click", onConnect);
  document.querySelector("#btn-disconnect").addEventListener("click", onDisconnect);
});
