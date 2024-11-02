import { ethers } from 'ethers'
import { L3Config } from './l3ConfigType'
import fs from 'fs'
import { ethOrERC20Deposit, ethOrERC20Deposit2 } from './nativeTokenDeposit'
import { createERC20Bridge, createERC20Bridge2 } from './createTokenBridge'
import { l3Configuration } from './l3Configuration'
import { defaultRunTimeState, RuntimeState } from './runTimeState'
import { transferOwner } from './transferOwnership'
import express, { Express, Request, Response } from "express";
import  bodyParser from 'body-parser';
import dotenv from "dotenv";
// Delay function
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function checkRuntimeStateIntegrity(rs: RuntimeState) {
  if (!rs.chainId) {
    rs.chainId = defaultRunTimeState.chainId
  }
  if (!rs.etherSent) {
    rs.etherSent = defaultRunTimeState.etherSent
  }
  if (!rs.nativeTokenDeposit) {
    rs.nativeTokenDeposit = defaultRunTimeState.nativeTokenDeposit
  }
  if (!rs.tokenBridgeDeployed) {
    rs.tokenBridgeDeployed = defaultRunTimeState.tokenBridgeDeployed
  }
  if (!rs.l3config) {
    rs.l3config = defaultRunTimeState.l3config
  }
  if (!rs.transferOwnership) {
    rs.transferOwnership = defaultRunTimeState.transferOwnership
  }
}

async function main(){
  dotenv.config();
  const app: Express = express();
  const port = process.env.PORT || 3000;
  // routes(app);
  app.use(express.json())
  app.use(bodyParser.urlencoded({ extended: false }));
  // app.get("/ping", (req: Request, res: Response) => {
  //   res.send("orbit token bridge setup server");
  // });

  app.post("/setup", async (req: Request, res: Response) => {
    const body = req.body;
    console.log("body: ", body);
    const tokenBridgeInfo = await setup(req.body.key, req.body.l1conn, req.body.l2conn, req.body.config);
    res.send(tokenBridgeInfo);
  })

  app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });
}

export interface SetupConfig {
  key: string
  l1conn: string
  l2conn: string
}

async function setup(privateKey: string, L2_RPC_URL: string, L3_RPC_URL: string, configRaw: string) {
  // Read the environment variables
  // const privateKey = "e21083ba1bb4628ad365e839b4d459b2360ac819aec5f8a5942d82bdb0de5107"
  // const L2_RPC_URL = "https://cool-shy-layer.arbitrum-sepolia.quiknode.pro/1d976d168d29cb416c2ccabccfddfc832294468d/"
  // const L3_RPC_URL = "https://wizard-test-orbit-yq3.alt.technology"

  if (!privateKey || !L2_RPC_URL || !L3_RPC_URL) {
    throw new Error('Required environment variable not found')
  }
  const config: L3Config = JSON.parse(configRaw)
  // Generating providers from RPCs
  const L2Provider = new ethers.providers.JsonRpcProvider(L2_RPC_URL)
  const L3Provider = new ethers.providers.JsonRpcProvider(L3_RPC_URL)

  // Checking if the L2 network is the expected parent chain
  if ((await L2Provider.getNetwork()).chainId !== config.parentChainId) {
    throw new Error(
      'The L2 RPC URL you have provided is not for the correct parent chain'
    )
  }

  // Creating the signer
  const signer = new ethers.Wallet(privateKey).connect(L2Provider)

  try {
    var tokenBridgeInfo;
    if (true) {
      ////////////////////////////////////////////
      /// ETH/Native token deposit to L3 /////////
      ////////////////////////////////////////////
      console.log(
        'Running Orbit Chain Native token deposit to Deposit ETH or native ERC20 token from parent chain to your account on Orbit chain ... 💰💰💰💰💰💰'
      )
      const oldBalance = await L3Provider.getBalance(config.chainOwner)
      await ethOrERC20Deposit2(privateKey, L2_RPC_URL, configRaw)
      let depositCheckTime = 0

      // Waiting for 30 secs to be sure that ETH/Native token deposited is received on L3
      // Repeatedly check the balance until it changes by 0.4 native tokens
      while (true) {
        depositCheckTime++
        const newBalance = await L3Provider.getBalance(config.chainOwner)
        if (newBalance.sub(oldBalance).gte(ethers.utils.parseEther('0.01'))) {
          console.log(
            'Balance of your account on Orbit chain increased by the native token you have just sent.'
          )
          break
        }
        let tooLongNotification = ''
        if (depositCheckTime >= 6) {
          tooLongNotification =
            "(It is taking a long time. Did you change the config files? If you did, you will need to delete ./config/My Arbitrum L3 Chain, since this chain data is for your last config file. If you didn't change the file, please ignore this message.)"
        }
        console.log(
          `Balance not changed yet. Waiting for another 30 seconds ⏰⏰⏰⏰⏰⏰ ${tooLongNotification}`
        )
        await delay(30 * 1000)
      }
    }

    if (true) {
      ////////////////////////////////
      /// Token Bridge Deployment ///
      //////////////////////////////
      console.log(
        'Running tokenBridgeDeployment or erc20TokenBridge script to deploy token bridge contracts on parent chain and your Orbit chain 🌉🌉🌉🌉🌉'
      )
      tokenBridgeInfo = await createERC20Bridge2(L2_RPC_URL, privateKey, L3_RPC_URL, config.rollup)
    }
    ////////////////////////////////
    /// L3 Chain Configuration ///
    //////////////////////////////
    if (true) {
      console.log(
        'Running l3Configuration script to configure your Orbit chain 📝📝📝📝📝'
      )
      await l3Configuration(privateKey, L2_RPC_URL, L3_RPC_URL)
    
    }
    ////////////////////////////////
    /// Transfering ownership /////
    //////////////////////////////
    if (true) {
      console.log(
        'Transferring ownership on L3, from rollup owner to upgrade executor 🔃🔃🔃'
      )
      await transferOwner(privateKey, L2Provider, L3Provider)
    }
    return tokenBridgeInfo
  } catch (error) {
    console.error('Error occurred:', error)
  }
}

// Run the script
main().catch(error => {
  console.error(error)
  process.exit(1)
})
