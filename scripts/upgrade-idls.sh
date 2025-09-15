source .env

anchor idl upgrade -f target/idl/governo.json \
  --provider.cluster https://mainnet.helius-rpc.com/?api-key=$API_KEY \
  --provider.wallet .keypair/admin.json \
  gov3LSmekCKmzLnKJ87csYdef5QNYM2G3kNDbhZekkA

anchor idl upgrade -f target/idl/rewarder.json \
  --provider.cluster https://mainnet.helius-rpc.com/?api-key=$API_KEY \
  --provider.wallet .keypair/admin.json \
  rev31KMq4qzt1y1iw926p694MHVVWT57caQrsHLFA4x

anchor idl upgrade -f target/idl/vesto.json \
  --provider.cluster https://mainnet.helius-rpc.com/?api-key=$API_KEY \
  --provider.wallet .keypair/admin.json \
  1ok3Ge8vXYPeQgwJd5GBQZkXqW34TbpkvP1APiDVtUF
