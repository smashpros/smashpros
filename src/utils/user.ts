import { Role, User } from "@prisma/client"
import { decode } from "jsonwebtoken"
import { prisma } from "../prisma"
import { cache } from "../redis"
import logger from "./logger"
import redisNamingStrategy from "./redisNamingStrategy"

export async function findUserByToken(token: string) {
  const now = +new Date()
  const decoded = decode(token)

  if (!decoded) {
    return null
  }

  // @ts-ignore
  const { exp, userId } = decoded
  const key = redisNamingStrategy.user(userId)
  const exists = await cache.exists(key) === 1
  let populatedUser: User & {roles: Role[]} = null

  if (!exists) {
    logger.info(`Creating new user entry in cache (${key})`)
    populatedUser = await prisma.user.findUnique({
      where: {
        id: userId
      },
      include: {
        roles: true
      }
    })

    cache.setex(key, 60 * 60, JSON.stringify(populatedUser))
  } else {
    logger.info(`Found user in cache (${key})`)
    const cachedUserString = await cache.get(key)
    populatedUser = JSON.parse(cachedUserString)
  }

  const user = now > exp ? populatedUser : null

  return user
}