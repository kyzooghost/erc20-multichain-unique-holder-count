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

(async () => {
    let mainnetHoldersMap = await getHoldersMapping(mainnetContract)
    let polygonHoldersMap = await getHoldersMapping(polygonContract)
    let auroraHoldersMap = await getHoldersMapping(auroraContract)
    // console.log(mainnetHoldersMap.size)
    // console.log(polygonHoldersMap.size)
    // console.log(auroraHoldersMap.size)

    const addressSet = getUniqueHoldersList(mainnetHoldersMap, polygonHoldersMap, auroraHoldersMap)
    console.log(addressSet)
    console.log("YOU HAVE", addressSet.size, "UNIQUE TOKEN HOLDERS")

})()

async function getHoldersMapping(contract) {
    // Get all Transfer events
    let filter = await contract.filters.Transfer()
    let events = await contract.queryFilter(filter)

    // need to sort by blockNumber as first precedence
    // then sort by transactionIndex
    events.sort(function (a, b) {
        if (a.blockNumber == b.blockNumber) {
            return (a.transactionIndex - b.transactionIndex)
        } else {
            return (a.blockNumber - b.blockNumber)
        }
    })

    // Create your holdings map
    const holders_map = new Map()

    // Loop through every event
    for (const event of events) {

        try {
            // Exclude 0 value transactions
            if (event.args.value.eq(ZERO)) {
                continue;
            }

            // Subtract value from 'from', except if from == zero address
            if (event.args.from != ZERO_ADDRESS) {
                // If "from" key doesn't exist, create new map entry with value = ZERO
                const current_holding = holders_map.get(event.args.from) ? holders_map.get(event.args.from) : ZERO
                holders_map.set(event.args.from, current_holding.sub(event.args.value))
            }

            // Add value to 'to'
            if (holders_map.has(event.args.to)) {
                const current_holding = holders_map.get(event.args.to)
                holders_map.set(event.args.to, current_holding.add(event.args.value))
            } else {
                holders_map.set(event.args.to, event.args.value)
            }
        } catch {
            // Catch block for troubleshooting and finding troublesome transactions
            console.log(event)
            console.log(holders_map.get(event.args.from))
            console.log("------")
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
            holdersSet.add(address)
        }
    }

    return holdersSet
}