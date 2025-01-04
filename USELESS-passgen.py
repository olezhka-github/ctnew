import random
chars = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890"
charlist = list(chars)
passrange = input()
pass = ''
stint = 0

def rand_key():
	elm1 = random.randint(0, len(charlist))
	elm2 = charlist[elm1] 
	return elm2
try: 
	tint = int(stint)
except:
	print('error')
print(tint)