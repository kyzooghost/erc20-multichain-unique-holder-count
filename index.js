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
        getPolygonHoldersMapping(polygonContract),
        getHoldersMapping(auroraContract)
    ])

    const addressSet = getUniqueHoldersList(mainnetHoldersMap, polygonHoldersMap, auroraHoldersMap)
    console.log(addressSet)
    console.log("YOU HAVE", addressSet.size, "UNIQUE TOKEN HOLDERS")
}

async function getHoldersMapping(contract) {
    const holders_map = new Map()

    // Get all Transfer events
    let filter = contract.filters.Transfer()
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
            holdersSet.add(address)
        }
    }

    return holdersSet
}

async function getPolygonHoldersMapping(contract) {
    const holders_map = new Map()

    // Get all Transfer events
    let filter = contract.filters.Transfer()
    
    const latestBlock = await contract.provider.getBlockNumber();

    // Needed to break up Polygon log query into two - was getting "Log response size exceeded" error
    const [events_0, events_1] = await Promise.all([
        contract.queryFilter(filter, 0, 28453267),
        contract.queryFilter(filter, 28453268, latestBlock)
    ])

    const events = [...events_0, ...events_1]

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