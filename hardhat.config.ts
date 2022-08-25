/**
 * @type import('hardhat/config').HardhatUserConfig
 */
import * as fs from 'fs';

import * as _ from 'lodash';
import { types, task } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "@tenderly/hardhat-tenderly";
import "hardhat-tracer";
import "hardhat-dependency-compiler";
import "hardhat-deploy";

if (process.env.REPORT_GAS) {
    require('hardhat-gas-reporter');
}

if (process.env.REPORT_COVERAGE) {
    require('solidity-coverage');
}

require('dotenv').config();

let { 
    ETHERSCAN_TOKEN,
    PRIVATE_KEY,
    PRIVATE_KEY_ADMIN1,
} = process.env;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const AccessType = Object.freeze({
    OPEN: 0,
    NON_CONTRACT: 1,
    LIMIT: 2
});


task("accounts", "Prints the list of accounts", async (args, { ethers }) => {
    const accounts = await ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
let networks;

if(PRIVATE_KEY) {
    let accounts = [
        PRIVATE_KEY,
    ]
    networks = {
        hardhat: {
            chainId: 1337,
        },
        rinkeby: {
            url: "https://eth-rinkeby.alchemyapi.io/v2/v92DVe9FFvr2lzRB4wjtk-z4DdsQjBhs",
            gasPrice: 5000000000,
            chainId: 4,
            accounts
        },
    };
} else {
    networks = {
        hardhat: {
            chainId: 1337
        },
    };
}

module.exports = {
    solidity: {
        version: "0.8.13",
        settings: {
            optimizer: {
                enabled: true,
                runs: 1337
            }
        }
    },
    defaultNetwork: "hardhat",
    networks: networks,
    etherscan: {
        apiKey: ETHERSCAN_TOKEN
    },
    dependencyCompiler: {
    },
    namedAccounts: {
        deployer: 0,
        admin1: 1,    // '0x51d9255fBb24238d8E8a841Dcb47ea67c95C98ca',
    },
    abiExporter: {
        path: './artifacts/abi',
        clear: true,
        flat: true,
        only: [':LegendaryNFT'],
        spacing: 2
    },
    gasReporter: {
        currency: 'USD',
        coinmarketcap: '46d51164-a690-4982-9c92-996297cc484b',
        gasPrice: 25,
        showTimeSpent: true,
    },
    plugins: ['solidity-coverage'],
    typechain: {
        outDir: './typechain',
        target: 'ethers-v5',
        alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
        externalArtifacts: ['externalArtifacts/*.json'], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
    },
};


