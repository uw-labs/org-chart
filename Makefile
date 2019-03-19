install:
	cd frontend && npm install

dev-frontend:
	cd frontend && npm start

build-frontend:
	cd frontend && npm run-script build

DOCKER_IMAGE=quay.io/utilitywarehouse/org-chart

build-docker:
	docker build -t $(DOCKER_IMAGE) .

docker-push:
	docker push $(DOCKER_IMAGE)

build: build-frontend build-docker
