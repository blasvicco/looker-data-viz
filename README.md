# Data Visualization Modules for Looker

At Enveritas, we use [Looker](https://looker.com) as part of our analysis work.
This repo contains some visualization plugins that we've developed for use in Looker Explores and dashboards.

### To use the container for developing purpose
1.- Install docker and docker compose.

2.- Build the image.
```BASH
docker compose build
```

3.- Start the container.
```BASH
docker compose up -d
```

4.- Call webpack build.
```BASH
docker exec -it enveritas yarn build
```

5.- Don't forget to stop the container when you don't need it anymore.
```BASH
docker compose down
```

### TreeMap

![TreeMap Screenshot](/app/assets/screenshot.png)
