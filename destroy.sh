cd infrastructure
export $(cat .env | xargs) && terraform destroy
