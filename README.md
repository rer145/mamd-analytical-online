# MaMD Analytical (online version)

An online version of the desktop MaMD Analytical program, developed by Dr. Joe Hefner.

## Projects

### mamd-api-base

The mamd-api-base project builds a Docker container with the required packages for the mamd-api container to run. This saves time in building the mamd-api container, since the packages required does not change often. 

This container uses the [rstudio/plumber](https://github.com/rstudio/plumber) package to serve up an API for use in the mamd-web project. This API can be called from anywhere, provided the proper parameters are passed in.

**Building/Deploying**
```
docker build -t mamd-api-base .
docker tag mamd-api-base rer145/mamd-api-base
docker push rer145/mamd-api-base
```

### mamd-api

The mamd-api project builds a Docker container with the analytical data and script to perform the analysis. It relies on the mamd-api-base to setup rstudio/plumber and constantly runs, waiting for inputs from the mamd-web project.

This container is currently running on an AWS Lightsail instance (Micro x1 - 1gb, 0.25 vCPUs).

**Building/Deploying**
```
docker build -t mamd-api .
docker tag mamd-api mamd-api:X.Y.Z
docker tag mamd-api:X.Y.Z rer145/mamd-api:X.Y.Z
docker push rer145/mamd-api:X.Y.Z
```

**Running**
```
docker run -it --rm -p 8000:8000 mamd-api /api.R

http://localhost:8000/mamd?group_list=American,African,Asian&ANS=1&INA=3&IOB=1&MT=1&NAW=1&NBC=1&NO=1&PBD=1&PZT=1&ZS=1

http://localhost:8000/mamd?group_list=AfrAm,EurAm,AsAm,Amerindian,SWHispanic&ANS=1&INA=0&IOB=3&MT=NA&NAW=3&NBC=1&NO=NA&PBD=1&PZT=NA&ZS=NA
```


### mamd-web

The mamd-web is a web interface for collecting and providing inputs for the mamd-api analysis. this is the same interface as the original desktop application, but updated to call the API and return back the analysis.

The parameters accepted to the ```/mamd``` endpoint are as follows:

|Name|Type|Description|Example|
|-|-|-|-|
|group_list|```string```|A comma separated list of groups to include in the analysis|American,African,Asian|
|ANS|```int```|Anterior Nasal Spine|1|
|INA|```int```|Inferior Nasal Aperture|1|
|IOB|```int```|Interorbital Breadth|1|
|MT|```int```|Nalar Tubercle|1|
|NAW|```int```|Nasal Aperture Width|1|
|NBC|```int```|Nasal Bone Contour|1|
|NO|```int```|Nasal Overgrowth|1|
|PBD|```int```|Postbregmatic Depression|1|
|PZT|```int```|Posterior Zygomatic Tubercle|1|
|ZS|```int```|Zygomaticomaxillary Suture|1|


The response from the API provides a JSON object with the following values:

|Property Name|Type|Description|Example|
|-|-|-|-|
|prediction|```string```|The predicted ancestry from the collected inputs|Asian|
|sensitivity|```decimal```|The predicted ancestry from the collected inputs|Asian|
|specification|```decimal```|The predicted ancestry from the collected inputs|Asian|
|probabilities|```decimal```|The predicted ancestry from the collected inputs|Asian|
|statistics.accuracy|```decimal```|The predicted ancestry from the collected inputs|Asian|
|statistics.accuracyLower|```decimal```|The predicted ancestry from the collected inputs|Asian|
|statistics.accuracyUpper|```decimal```|The predicted ancestry from the collected inputs|Asian|
|matrix|```matrix```|The predicted ancestry from the collected inputs|Asian|



**Buliding/Deploying**

This project is built and deployed to AWS using a manually run GitHub Action.