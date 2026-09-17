pipeline {
    agent any

    triggers {
        pollSCM('H/3 * * * *')
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }

    stages{
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install & Lint & Build') {
            agent {
                docker {
                    image 'node:22-alpine'
                    reuseNode true
                }
            }

            steps {
                sh 'node -v && npm -v'
                sh 'npm ci'
                sh 'npm run lint'
                sh 'npm run build' 
            }
        }        
    }

    post {
        success {
            archiveArtifacts artifacts: 'dist/**/*', fingerprint: true, allowEmptyArchive: false
        } 
        failure {
            echo "Pipeline thất bại - xem log từng stage."    
        }
    }
}