# install java
apt-get install -yq openjdk-17-jdk

# install nodejs
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -yq nodejs

mkdir /home/minecraft
cd /home/minecraft

# Download latest server.jar
# TODO: check if the latest version is already downloaded
echo "Downloading latest server.jar..."
latest_version_url=$(node -e "fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json').then(res=>res.json()).then(versions=>fetch(versions.versions.find((version) => version.id === versions.latest.release).url)).then(res=>res.json()).then(version=>console.log(version.downloads.server.url))")
curl -o server.jar $latest_version_url

# TODO: setup backups job
# TODO: setup automatic shutdown on server empty

if [ ! -f eula.txt ]; then
	# # prompt user to accept eula
	# echo "Do you accept the Minecraft EULA? (https://aka.ms/MinecraftEULA) [y/n]"
	# read eula

	# if [ "$eula" != "y" ]; then
	# echo "You must accept the EULA to run the server. Exiting."
	# exit 1
	# fi

	# create eula.txt
	echo "eula=true" > eula.txt
fi


# Start server
java -Xms6G -Xmx6G -XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:MaxGCPauseMillis=50 -XX:+DisableExplicitGC -XX:TargetSurvivorRatio=90 -XX:G1NewSizePercent=50 -XX:G1MaxNewSizePercent=80 -XX:InitiatingHeapOccupancyPercent=10 -XX:G1MixedGCLiveThresholdPercent=50 -jar server.jar nogui
