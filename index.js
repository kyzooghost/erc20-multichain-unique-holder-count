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
    const [mainnetHoldersMap, polygonHoldersMap] = await Promise.all([
        getHoldersMapping(mainnetContract),
        getPolygonHoldersMapping(polygonContract),
        // getAuroraHoldersMapping(auroraContract)
    ])

    let mainnetTokenholderCount = 0;
    let polygonTokenholderCount = 0;

    for (const address of mainnetHoldersMap.keys()) {
        mainnetTokenholderCount += 1
    }

    for (const address of polygonHoldersMap.keys()) {
        polygonTokenholderCount += 1
    }

    console.log("mainnet tokenholders: ", mainnetTokenholderCount)
    console.log("polygon tokenholders: ", polygonTokenholderCount)

    let addressSet = getUniqueHoldersList(mainnetHoldersMap, polygonHoldersMap)
    // const addressSet = getUniqueHoldersList(mainnetHoldersMap, polygonHoldersMap, auroraHoldersMapping)

    // Add aurora tokenholders to set
    const auroraTokenholders = getAuroraHoldersMappingAlternate()
    for (const address of auroraTokenholders) {addressSet.add(address)}

    console.log(addressSet)
    console.log("YOU HAVE", addressSet.size, "UNIQUE TOKEN HOLDERS")
}

async function getHoldersMapping(contract, end = 0) {
    const holders_map = new Map()

    // Get all Transfer events
    let filter = contract.filters.Transfer()
    let events;

    if (end == 0) {
        events = await contract.queryFilter(filter)
    } else {
        events = await contract.queryFilter(filter, 10000000, end)
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

    let length = 0;
    for (const e of holders_map.keys()) {
        length += 1;
    }

    return holders_map
}

function getUniqueHoldersList(...mapArgs) {
    let holdersSet = new Set()

    // Iterate through mapArgs
    for (let map of mapArgs) {
        // Iterate through map keys
        const addressIterator = map.keys()
        for (const address of addressIterator) {

            if ( address.substring(0, 8).toLowerCase() != "0x501ace" ) {
                holdersSet.add(address)
            } 
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

async function getAuroraHoldersMapping(contract) {
    const holders_map = new Map()

    // Get all Transfer events
    let filter = contract.filters.Transfer()
    
    const latestBlock = await contract.provider.getBlockNumber();

    // First block for Aurora SOLACE ransfers
    const startBlock = 58837300

    // Playing a guessing game of what blockBatchSize will yield <= 1000 events
    const blockBatchSize = 25000

    console.log("A")
    await contract.queryFilter(filter, startBlock, startBlock + blockBatchSize)
    console.log("B")

    let i = 0;
    const promises = []

    while (true) {
        if ( startBlock + (i + 1) * blockBatchSize < latestBlock ) {
            promises.push(contract.queryFilter(filter, startBlock + i * blockBatchSize, startBlock + (i + 1) * blockBatchSize))
        } else {
            promises.push(contract.queryFilter(filter, startBlock + i * blockBatchSize, latestBlock))
            break;
        }
        i += 1;
    }

    let events = []

    // Avoid concurrency limit, process `numOfConcurrentBatches` batches at a time
    const numOfConcurrentBatches = 10

    while(promises.length) {
        console.log(`${promises.length} batches to go`)

        const array_of_events_array = await Promise.all(promises.splice(0, numOfConcurrentBatches))

        for (const events_array of array_of_events_array) {
            console.log(events_array.length)
            events = [...events, ...events_array]
        }
    }

    console.log(`${events.length} Transfer events captured`)

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

function getAuroraHoldersMappingAlternate() {
    let unchecksummed_tokenholders = [
        "0x029575efbd4ba27217010ef7ae20534f674d842d",
        "0x0436c20030d0c2e278e7e8e4b42d304a6420d3bb",
        "0x04cb22bb3cd5544ad70fa9e7c54ba18b537d6300",
        "0x08f8f2e7d15b821cf2a3bb6824279d473dd7508b",
        "0x0cb556aebe39b3c9ef5cbe8b668e925db10a2d7d",
        "0x0d088aa222f2d237d364dea94ce955af64e26794",
        "0x0ea5d709851ae7a6856677b880b8c56e87e7877b",
        "0x128fbcbea19d753231d9f037a19b13a7e5af2ec9",
        "0x160f1ab6e10e231cc89ba023006eabf20ffadd68",
        "0x165baa9b6bc744bb5b50076904a743cda18233c8",
        "0x1dada082a88f17c9ca79920ed0d23ce6d73bfe71",
        "0x1eed4b0bc4c8a7201c28640cbc6e7782b38033e0",
        "0x1f464cce5b1d1fc8fe54eb1b2ec3c9f67a55ebba",
        "0x1fc6e73075c584dbdda0e53449e2c944986b9a72",
        "0x2287b42b2f1c24b09309a6344ca931524e5bf3c6",
        "0x27ee985d1e446ec71c277c89cd877ec4eeaa236c",
        "0x2863aa2bcd6293ddd97bd9162d9e3d44eb53cb4c",
        "0x28c5d7aa1532361e1d207f612e6126f9cb6e5cf5",
        "0x2aee1667a96e1aa112ec1bd9e92e5569eb741f3b",
        "0x2b271cdacb16fbd6885e0cf4a6f1a7a05d3da068",
        "0x2d2a71bc98abe5cca27b8067ac2afaba95a19df3",
        "0x3559c78137cddfa06c11231c6033f09c1b860bb3",
        "0x3a3a2377fc4695f33b3bc7a33cacc8d6e504ab6f",
        "0x3b4b11d6185c5face142bae310afb6e3b5189330",
        "0x41008953f57c969aa15608ce3db8be893cc71b85",
        "0x479b35fa9a0e3ee6c9e39db1fe3f66d6cf8f613f",
        "0x47cb9e281a6fe2ad7a129e88207744082bac9f38",
        "0x47eb0bc914e43d697cb3b324a20d47c7da505eae",
        "0x48673ef535f4203ead5e638250acc6dc9bdee331",
        "0x4a6b0f90597e7429ce8400fc0e2745add343df78",
        "0x4dea0eb50e61368ef2deb64a4272f0eb77aaa68e",
        "0x501ace47c5b0c2099c4464f681c3fa2ecd3146c1",
        "0x501ace5ceec693df03198755ee80d4ce0b5c55fe",
        "0x501ace71a83cbe03b1467a6ffeaeb58645d844b4",
        "0x501ace7e977e06a3cb55f9c28d5654c9d74d5ca9",
        "0x501acee6350bb566ebe4a0dabdc9901100b8c445",
        "0x50fb80804b7022e68fc9d5b84a8fd0acbd1fd484",
        "0x5701068ca0ba0338a5b64e8f59d5ae661e9ecfc0",
        "0x586fd53b53175e41374aed1a4009eb87ad3b2221",
        "0x58e6884f4c0c5f8114854ef7322b4cf03086f1fb",
        "0x5acfd914f2dfd41f07f27407bd7936f43d0db167",
        "0x5e555f61ec998cbaff44ef22934821f9adc4682d",
        "0x5ea46452eda0ae145cebb86772e807fab66dd048",
        "0x60e4027497373810c286980e176bffe051f14aff",
        "0x660d41dd33e49ec1667f1ad17d2c81fb6f6a1158",
        "0x672584379ae3082b25f794e7224057e1b8b3553d",
        "0x6a9d63cbb02b6a7d5d09ce11d0a4b981bb1a221d",
        "0x6cf218ce6539161dc028857c6de14503e685444b",
        "0x76007f7db2e419c3f0445f7d144809a36765617b",
        "0x7a139fc5d92bea22c32dbadc9edfac1f24febb38",
        "0x7c89e30055afbd0f004146baa4bf0708a0d74fcd",
        "0x8553077c859f039cc01c64e9e92943b678c929e9",
        "0x8868a2eae35f1f53d3f8e464c060be9755c8d51c",
        "0x89d0dfb58149fb1ff7471983191f6e0ef5c06dcd",
        "0x8b5d7bb4c21fbbe2a09a8a715e006ea084d0a1a5",
        "0x8c3f353ce0c459d0640be58bd4675e7b478a4e6f",
        "0x9f45a94158f57fe67a5b3d00f67647d0fe00e180",
        "0x9fcfa92b3184e0888eb0e3ee3663cc2c8750de7e",
        "0xa043ffeda30e6fd5aa4a6bb31ef770e9af3f4354",
        "0xa356c5f895a0779f5b97093780bd5b8ff097f1be",
        "0xa400f843f0e577716493a3b0b8bc654c6ee8a8a3",
        "0xa969740b3018884cdc10233a506e00851b5d036e",
        "0xacfe4511ce883c14c4ea40563f176c3c09b4c47c",
        "0xad7b410c5ae8f2763b3577b21ab91e87e95ff643",
        "0xae94c845fb9a2f4a342db495b542ef81a17fefbe",
        "0xb1fc41cbad16cafdfc2ed196c7fe515dfb6a1577",
        "0xb30816788feedb74156d537e25c9c473880ae5e3",
        "0xbcb39875fbdbee2ee20cedd05d423bdeb6c1c932",
        "0xbde8496025017c56e722635d2d65f2fdaa90d7ee",
        "0xc0e6592ce0cb9c552bfc27dddd62821bdfefeaed",
        "0xc591323f04d9b71270b65631694d1d4452cb3f4a",
        "0xc7119808623e0d8810851070f4536af23d3b9ed5",
        "0xcb8c4416cd10836ff7a35f4b2afd5be0257cc9db",
        "0xcc723efd32e06bd3ef82b0c8a2004285cd0d3866",
        "0xce1e1e2fa55d38495574cbf2001d27d1852109a7",
        "0xd4606636d5a8e4e09d9efa84a0d342d39385afad",
        "0xd9f9c316888fddd44931c97beddfc89f9b39b967",
        "0xdb5b4853ceabf6d8e08d73fddfa80f507ef9fba4",
        "0xdd13eb27af410ea094c2ac357f1b79b62f738062",
        "0xddadf88b007b95feb42ddbd110034c9a8e9746f2",
        "0xdf83e7fee9c1fa901768e431b316d92850a6f4e7",
        "0xe2e58503f98b1320d443d4c36fd4ed8b50879add",
        "0xe53d3f2b99fe0ed6c05977bc0547127836f0d78d",
        "0xe570937e1936be9198f80d6a084e7f36cf72e08c",
        "0xe621b2d01a25ea037e4bb1aef7531a7cdecf90f8",
        "0xe6dc7c97ca7679dde8f96ba4de2aacd6cdde0f50",
        "0xe85909f8a1753734b19dd7abcfe40fda79f39c78",
        "0xe9631b38dc0bc849b3cc30d36e859b83b46da4f9",
        "0xecbaadbdf2388165db563813e764addb29f7a152",
        "0xf1e9cbe3d592a4618d2b9583324db8a13ccf5b1d",
        "0xf29d9bc8b46b2ff26867bed73ba2def0e160bbff",
        "0xf3ccdb36a8f756b46b5f41e1a79175e7f72ff662",
        "0xf90b82bee353168831088541c1ed983322bf87d4",
        "0xf97ff83d835e7e2d0cb0198612d20f0076fd901f",
        "0xf9af2e7927577d366291d8986dbd15dacef676a6",
        "0xfa912046abb0eb3511be6443738e4899acf335f8",
        "0xfc70efe289cf8efa0680971ed69c9c43e2d807a7",
        "0xfe3a593fb8a90185a8e31edc8eb02e7d889d52f0",
        "0xfea350f9c980a1c73429459a10913db29c31e277",
        "0xfef5c1417a7dba19b5246a68b528bda91001abe2",
        "0xff77216db4c80c7daab04606e912954174eeaaaa",
    ]

    let tokenholders = []

    for (let address of unchecksummed_tokenholders) {

        // Don't include SOLACE addresses
        if ( address.substring(0, 8).toLowerCase() != "0x501ace" ) {
            tokenholders.push(ethers.utils.getAddress(address))
        }
    }

    console.log("Aurora tokenholders: " , tokenholders.length)

    return tokenholders
}