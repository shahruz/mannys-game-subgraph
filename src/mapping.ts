import { Address, BigInt, Bytes, ipfs, json } from '@graphprotocol/graph-ts';
import {
  MannysGame,
  SetBaseURICall,
  Transfer
} from '../generated/MannysGame/MannysGame';
import { Manny, Trait, Wallet, Game } from '../generated/schema';

export function handleTransfer(event: Transfer): void {
  let tokenId = event.params.tokenId;
  let contract = MannysGame.bind(event.address);
  let manny = Manny.load(tokenId.toString());
  if (!manny) {
    manny = new Manny(tokenId.toString());
    loadManny(manny as Manny, contract);
    manny.minted = event.block.timestamp;
    manny.updates = 0;
    manny.lastUpdated = event.block.timestamp;
    let game = Game.load('mannys.game');
    if (!game) {
      game = new Game('mannys.game');
      game.totalMannys = 0;
    }
    game.totalMannys++;
    game.save();
  }

  let wallet = new Wallet(event.params.to.toHexString());
  wallet.save();

  manny.owner = wallet.id;
  manny.save();
}

export function handleSetBaseURI(call: SetBaseURICall): void {
  let contract = MannysGame.bind(call.to);
  let mannyCount = contract.totalSupply();
  for (let i = 0; i < mannyCount.toI32(); i++) {
    let manny = Manny.load(i.toString());
    if (!manny) continue;
    loadManny(manny as Manny, contract);
    manny.updates++;
    manny.lastUpdated = call.block.timestamp;
    manny.save();
  }
}

function loadManny(manny: Manny, contract: MannysGame): void {
  let hash = contract.try_tokenURI(BigInt.fromString(manny.id));
  if (hash.reverted) return;
  let data = ipfs.cat(hash.value.toString().slice(7)); // replace 'ipfs://' with ''
  if (data != null) {
    let meta = json.fromBytes(data as Bytes);
    if (!meta.isNull()) {
      let object = meta.toObject();
      if (!object.get('name').isNull())
        manny.name = object.get('name').toString();
      if (!object.get('token_id').isNull())
        manny.tokenId = object
          .get('token_id')
          .toBigInt()
          .toI32();

      if (!object.get('description').isNull())
        manny.description = object.get('description').toString();
      if (!object.get('image').isNull())
        manny.image = object.get('image').toString();
      if (!object.get('avatar_url').isNull())
        manny.avatarUrl = object.get('avatar_url').toString();
      if (!object.get('texture_url').isNull())
        manny.textureUrl = object.get('texture_url').toString();
      if (!object.get('external_url').isNull())
        manny.externalUrl = object.get('external_url').toString();
      if (!object.get('animation_url').isNull())
        manny.animationUrl = object.get('animation_url').toString();
      if (!object.get('iframe_url').isNull())
        manny.iframeUrl = object.get('iframe_url').toString();
      if (!object.get('attributes').isNull()) {
        let attributes = object.get('attributes').toArray();
        let attributesArray = [] as Array<string>;
        for (let j = 0; j < attributes.length; j++) {
          let trait_type = object
            .get('attributes')
            .toArray()
            [j].toObject()
            .get('trait_type')
            .toString();
          let value = object
            .get('attributes')
            .toArray()
            [j].toObject()
            .get('value')
            .toString();
          let trait = new Trait(trait_type + '-' + value);
          trait.traitType = trait_type;
          trait.value = value;
          trait.save();
          attributesArray.push(trait.id);
        }
        manny.attributes = attributesArray;
      }
    }
  }
}
