from django.db import models
from django.contrib.auth.models import AbstractUser
from ckeditor.fields import RichTextField
from cloudinary.models import CloudinaryField

class User(AbstractUser):
    avatar = CloudinaryField(null=True)

class Topic(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name

class Level(models.Model):
    name = models.CharField(max_length=100, unique=True)
    note = models.TextField(max_length=200)

    def __str__(self):
        return self.name

class BaseModel(models.Model):
    name = models.CharField(max_length=50)
    description = RichTextField()
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class Subject(BaseModel):

    def __str__(self):
        return self.name

class Resource(BaseModel):
    file = models.FileField(default="")
    level = models.ForeignKey(Level, on_delete=models.RESTRICT)
    topic = models.ForeignKey(Topic, on_delete=models.RESTRICT)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
