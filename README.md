Script to calculate unique SOLACE token holder count across Ethereum, Polygon and Aurora chains.

Annoyingly I could not find an API method for Etherscan, Polygonscan and Aurorascan that exposed the holder count for any ERC20 token, even though this statistic is readily available through their frontend.

This script can be easily adapted to count unique token holders for any ERC20 across any selection of chains

# How to use

1. 'git clone' and 'npm install' this repo
2. Set up environment variables as per .env.example
3. `node index`