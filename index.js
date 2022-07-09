const ethers = require("ethers")
const ERC20_ABI = require("./ERC20.json")
require('dotenv').config()

let TOKEN_ADDRESS = "0x501acE9c35E60f03A2af4d484f49F9B1EFde9f40"
const ZERO = ethers.BigNumber.from("0")
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const mainnetProvider = new ethers.providers.JsonRpcProvider(process.env.MAINNET_URL)
const polygonProvider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_URL)
const auroraProvider = new ethers.providers.JsonRpcProvider(process.env.AURORA_URL)

const mainnetContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, mainnetProvider);
const polygonContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, polygonProvider);
const auroraContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, auroraProvider);

// Alternate way to get Aurora tokenholders set
// https://aurorascan.dev/token/0x501ace9c35e60f03a2af4d484f49f9b1efde9f40#balances
// Copy-paste list to hardcoded address array in getAuroraHoldersMappingAlternate()

const startTime = new Date()

main()
    .then((resp) => {
        console.log(resp)
        console.log("SUCCEED IN", (new Date() - startTime) / 1000 )
    })
    .catch((e) => {
        console.log("FAILED IN", (new Date() - startTime) / 1000 )
        console.error(e)
    })

async function main() {
    const [mainnetHoldersMap, polygonHoldersMap, auroraHoldersMap] = await Promise.all([
        getHoldersMapping(mainnetContract),
        getHoldersMapping(polygonContract),
        getHoldersMapping(auroraContract)
    ])

    let mainnetTokenholderCount = 0;
    let polygonTokenholderCount = 0;
    let auroraTokenholderCount = 0;

    for (const address of mainnetHoldersMap.keys()) {
        mainnetTokenholderCount += 1
    }

    for (const address of polygonHoldersMap.keys()) {
        polygonTokenholderCount += 1
    }

    for (const address of auroraHoldersMap.keys()) {
        auroraTokenholderCount += 1
    }

    console.log("mainnet tokenholders: ", mainnetTokenholderCount)
    console.log("polygon tokenholders: ", polygonTokenholderCount)
    console.log("aurora tokenholders: ", auroraTokenholderCount)

    let addressSet = getUniqueHoldersList(mainnetHoldersMap, polygonHoldersMap, auroraHoldersMap)
    console.log(addressSet)
    console.log("YOU HAVE", addressSet.size, "UNIQUE TOKEN HOLDERS")
}

async function getHoldersMapping(contract, end = 0) {
    const holders_map = new Map()

    // Get all Transfer events
    let filter = contract.filters.Transfer()
    let events;

    if (end == 0) {
        events = await fetchEvents(contract, filter, 0, "latest")
        // events = await contract.queryFilter(filter)
    } else {
        events = await fetchEvents(contract, filter, 0, end)
        // events = await contract.queryFilter(filter, 10000000, end)
    }

    // need to sort by blockNumber as first precedence
    // then sort by transactionIndex
    events.sort(function (a, b) {
        if (a.blockNumber == b.blockNumber) {
            return (a.transactionIndex - b.transactionIndex)
        } else {
            return (a.blockNumber - b.blockNumber)
        }
    })

    // Loop through every event
    for (const event of events) {
        const { from, to, value } = event.args

        try {
            // Exclude 0 value transactions
            if (value.eq(ZERO)) {
                continue;
            }

            // Subtract value from 'from', except if from == zero address
            if (from != ZERO_ADDRESS) {
                // If "from" key doesn't exist, create new map entry with value = ZERO
                const current_from_holding = holders_map.get(from) ? holders_map.get(from) : ZERO
                holders_map.set(from, current_from_holding.sub(value))
            }

            // Add value to 'to'
            const current_to_holding = holders_map.get(to) ? holders_map.get(to) : ZERO
            holders_map.set(to, current_to_holding.add(value))

        } catch(e) {
            // Catch block for troubleshooting and finding troublesome transactions
            console.log(event)
            console.log("------")
            console.error(e)
        }
    }

    // Iterate through mapping and remove zero balance addresses
    for (let [key, value] of holders_map) {
        if (value.eq(ZERO)) {
            holders_map.delete(key)
        }
    }

    // Delete zero address
    holders_map.delete(ZERO_ADDRESS)

    return holders_map
}

function getUniqueHoldersList(...mapArgs) {
    let holdersSet = new Set()

    // Iterate through mapArgs
    for (let map of mapArgs) {
        // Iterate through map keys
        const addressIterator = map.keys()
        for (const address of addressIterator) {

            // if ( address.substring(0, 8).toLowerCase() != "0x501ace" ) {
                holdersSet.add(address)
            // } 
        }
    }

    return holdersSet
}

async function fetchEvents(contract, eventFilter, startBlock, endBlock) {
    return new Promise(async (resolve,reject) => {
      if(endBlock == 'latest') endBlock = await contract.provider.getBlockNumber()
      try {
        const events = await contract.queryFilter(eventFilter, startBlock, endBlock)
        resolve(events)
        return
      } catch(e) {
        const errorString = e.toString();
  
        if(
            !errorString.includes("10K") && 
            !errorString.includes("1000 results") && 
            !errorString.includes("statement timeout") &&
            !errorString.includes("response size exceeded")
        ) {
          reject(e)
          return
        }
        
        // log response size exceeded. recurse down
        const midBlock = Math.floor((startBlock+endBlock)/2)

        const [left, right] = await Promise.all([
          fetchEvents(contract, eventFilter, startBlock, midBlock),
          fetchEvents(contract, eventFilter, midBlock+1, endBlock),
        ])

        const res = left.concat(right)

        resolve(res)
      }
    })
}