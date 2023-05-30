folders="functions"

for folder in $folders
do
	cd $folder
	npm run build
	cd ..
done
