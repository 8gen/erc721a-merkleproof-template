const keccak256 = require("keccak256");
const { MerkleTree } = require("merkletreejs");
const Web3 = require("web3");
const web3 = new Web3();
const fs = require("fs");



let CHAIN_ID = process.env.CHAIN_ID || 4;
let INPUT = process.env.INPUT || "addrs.txt";

let addresses = fs.readFileSync(INPUT).toString().split("\n").filter(n => n);

const leafNodes = addresses.map((item) =>
  keccak256(
    Buffer.concat([
        Buffer.from(web3.eth.abi.encodeParameter("uint256", item.toLowerCase()).replace("0x", ""), "hex"),
        Buffer.from(web3.eth.abi.encodeParameter("uint256", CHAIN_ID).replace("0x", ""), "hex"),
    ])
  )
);

const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });

console.log("---------");
console.log("Merke Tree");
console.log("---------");
console.log(merkleTree.toString());
console.log("---------");
console.log("Merkle Root: " + merkleTree.getHexRoot());

let result = {};
for(var index in leafNodes) {
    const node = leafNodes[index];
    const addr = addresses[index];
    const proofs = merkleTree.getHexProof(node);
    result[addr] = proofs;
}

fs.writeFileSync("proofs.json", JSON.stringify(result, undefined, 4));
console.log("Saved to proofs.json");

