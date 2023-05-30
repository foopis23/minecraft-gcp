# build step
./build.sh

# pre-deploy step
# run pre-deploy script
folders="functions"
for folder in $folders
do
	cd $folder
	npm run pre-deploy
	cd ..
done

# deploy with terraform
cd infrastructure
terraform init
export $(cat .env | xargs) && terraform apply
