import {
  createFungible,
  mplTokenMetadata,
} from '@metaplex-foundation/mpl-token-metadata'
import {
  createTokenIfMissing,
  findAssociatedTokenPda,
  getSplAssociatedTokenProgramId,
  mintTokensTo,
} from '@metaplex-foundation/mpl-toolbox'
import {
  generateSigner,
  percentAmount,
  createGenericFile,
  keypairIdentity,
} from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys'
import { base58 } from '@metaplex-foundation/umi/serializers'
import fs from 'fs'

const createNexusCoreToken = async () => {
  // Initialize Umi with Devnet
  const umi = createUmi("https://api.devnet.solana.com")
    .use(mplTokenMetadata())
    .use(irysUploader())

  // Load your existing Solana wallet
  const walletFile = fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf-8')
  const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(JSON.parse(walletFile)))
  umi.use(keypairIdentity(keypair))

  console.log("🚀 Creating NexusCore Token (NXC)...")
  console.log("Wallet:", umi.identity.publicKey)

  const logoSvg = `
    <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="coreGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#00ff88;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#0099ff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#6600ff;stop-opacity:1" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Outer hexagonal frame -->
      <polygon points="150,20 250,80 250,170 150,230 50,170 50,80" 
               fill="none" stroke="url(#coreGradient)" stroke-width="4" filter="url(#glow)"/>
      
      <!-- Inner core circle -->
      <circle cx="150" cy="125" r="60" fill="url(#coreGradient)" filter="url(#glow)"/>
      
      <!-- Connection nodes -->
      <circle cx="150" cy="40" r="8" fill="#00ff88"/>
      <circle cx="220" cy="90" r="8" fill="#0099ff"/>
      <circle cx="220" cy="160" r="8" fill="#6600ff"/>
      <circle cx="150" cy="210" r="8" fill="#00ff88"/>
      <circle cx="80" cy="160" r="8" fill="#0099ff"/>
      <circle cx="80" cy="90" r="8" fill="#6600ff"/>
      
      <!-- Token symbol -->
      <text x="150" y="135" font-family="Arial Black" font-size="28" 
            fill="white" text-anchor="middle" font-weight="bold">NXC</text>
    </svg>
  `

  const imageData = "data:image/svg+xml;base64," + Buffer.from(logoSvg).toString('base64')
  const imageFile = Buffer.from(logoSvg, 'utf-8')
  const umiImageFile = createGenericFile(imageFile, 'nexuscore-logo.svg', {
    tags: [{ name: 'Content-Type', value: 'image/svg+xml' }],
  })

  // Upload image to Arweave
  console.log(" Uploading NexusCore logo to Arweave...")
  const imageUri = await umi.uploader.upload([umiImageFile])
  console.log("✅ Image URI:", imageUri[0])

  // Create comprehensive metadata following best practices
  const metadata = {
    name: "NexusCore Token",
    symbol: "NXC", 
    description: "NexusCore (NXC) is the foundational token powering decentralized network connections and cross-chain interoperability. Built on Solana for lightning-fast transactions and minimal fees, NXC serves as the core utility token for next-generation DeFi protocols.",
    image: imageUri[0],
    external_url: "https://nexuscore.network",
    attributes: [
      { trait_type: "Token Type", value: "Utility" },
      { trait_type: "Blockchain", value: "Solana" },
      { trait_type: "Standard", value: "SPL Token" },
      { trait_type: "Use Case", value: "Cross-Chain Bridge" },
      { trait_type: "Rarity", value: "Genesis Collection" }
    ],
    properties: {
      category: "fungible",
      creators: [
        {
          address: umi.identity.publicKey,
          share: 100
        }
      ]
    }
  }

  // Upload metadata to Arweave  
  console.log("📤 Uploading metadata to Arweave...")
  const metadataUri = await umi.uploader.uploadJson(metadata)
  console.log("✅ Metadata URI:", metadataUri)

  // Generate mint keypair
  const mintSigner = generateSigner(umi)
  console.log("💎 NexusCore Token Mint Address:", mintSigner.publicKey)

  // Create the fungible token with enhanced parameters
  console.log("🔨 Minting NexusCore Token...")
  const createTokenIx = createFungible(umi, {
    mint: mintSigner,
    name: "NexusCore Token",
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(0), // No royalties for utility token
    decimals: 8, // 8 decimals for precision
  })

  // Create associated token account
  const createTokenAccountIx = createTokenIfMissing(umi, {
    mint: mintSigner.publicKey,
    owner: umi.identity.publicKey,
    ataProgram: getSplAssociatedTokenProgramId(umi),
  })

  // Mint initial supply: 5,000,000 NXC tokens
  const initialSupply = BigInt(5_000_000 * Math.pow(10, 8)) 
  const mintTokensIx = mintTokensTo(umi, {
    mint: mintSigner.publicKey,
    token: findAssociatedTokenPda(umi, {
      mint: mintSigner.publicKey,
      owner: umi.identity.publicKey,
    }),
    amount: initialSupply,
  })

  // Execute the complete transaction
  console.log("📡 Broadcasting transaction to Solana Devnet...")
  const tx = await createTokenIx
    .add(createTokenAccountIx)
    .add(mintTokensIx)
    .sendAndConfirm(umi)

  const signature = base58.deserialize(tx.signature)[0]

  console.log("\n🎉 NexusCore Token Successfully Created!")
  console.log("=" .repeat(50))
  console.log("🏷️  Token Name: NexusCore Token (NXC)")
  console.log("🏦  Mint Address:", mintSigner.publicKey)
  console.log("💰  Initial Supply: 5,000,000 NXC")
  console.log("🔢  Decimals: 8")
  console.log("📊  Network: Solana Devnet")
  console.log("🔐  Transaction Signature:", signature)
  console.log("\n🔗 Verification Links:")
  console.log("📋  Transaction Explorer:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`)
  console.log("🏛️  Token Mint Page:", `https://explorer.solana.com/address/${mintSigner.publicKey}?cluster=devnet`)
  console.log("🖼️  Metadata:", metadataUri)
  console.log("🌐  Image:", imageUri[0])
  
  // Save comprehensive token information
  const tokenInfo = {
    name: "NexusCore Token",
    symbol: "NXC",
    mintAddress: mintSigner.publicKey.toString(),
    decimals: 8,
    initialSupply: "5,000,000",
    totalSupplyRaw: initialSupply.toString(),
    transactionSignature: signature,
    network: "devnet",
    explorerUrls: {
      transaction: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      mint: `https://explorer.solana.com/address/${mintSigner.publicKey}?cluster=devnet`
    },
    metadata: {
      uri: metadataUri,
      imageUri: imageUri[0],
      description: metadata.description
    },
    createdAt: new Date().toISOString(),
    walletAddress: umi.identity.publicKey.toString()
  }
  
  fs.writeFileSync('./nexuscore-token-info.json', JSON.stringify(tokenInfo, null, 2))
  console.log("\n💾 Complete token information saved to nexuscore-token-info.json")

  return tokenInfo
}

// Execute token creation
createNexusCoreToken()
  .then((info) => {
    console.log("\n✅ NexusCore Token deployment complete!")
    console.log("📁 Check nexuscore-token-info.json for all details")
  })
  .catch((error) => {
    console.error("\n❌ Error creating NexusCore Token:", error)
    process.exit(1)
  })
