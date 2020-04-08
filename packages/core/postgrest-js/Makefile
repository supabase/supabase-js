REPO_DIR=$(shell pwd)

help:
	@echo "\nDOCKER\n"
	@echo "make start.{local|staging|prod}      # start backend "
	@echo "make remove.{local|staging|prod}     # remove backend "
	@echo "make rebuild.{local|staging|prod}    # rebuild backend - loses any changes to the database"
	@echo "make pull.{local|staging|prod}       # pull all the latest docker images"

#########################
# Docker 
#########################


start:
	docker-compose up

remove:
	docker-compose down --remove-orphans

rebuild:
	docker-compose down --remove-orphans
	docker-compose build
	docker-compose up --force-recreate

pull:
	docker-compose pull