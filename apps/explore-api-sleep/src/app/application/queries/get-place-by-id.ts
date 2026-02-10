import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import z from 'zod';
import { BaseCommand } from '../../libs/shared/command.js';
import { Place } from '../../domain/entities/place.js';
import { PlaceBookmarked } from '../../domain/entities/place-bookmarked.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { ApiPlaceDetail } from '../viewmodels/api-place-detail.js';
import { NotFoundException } from '../../libs/exceptions/not-found-exception.js';
import { PlaceLiked } from '../../domain/entities/place-liked.js';
import { PlaceExplored } from '../../domain/entities/place-explored.js';
import { PlaceViewed } from '../../domain/entities/place-viewed.js';
import { ApiPlaceType } from '../viewmodels/api-place-type.js';
import { Review } from '../../domain/entities/review.js';

type Payload = {
  id: string;
};

export class GetPlaceByIdQuery extends BaseCommand<Payload> {
  validate(props: Payload): Payload {
    return z
      .object({
        id: z.string(),
      })
      .parse(props);
  }
}

@QueryHandler(GetPlaceByIdQuery)
export class GetPlaceByIdQueryHandler
  implements IQueryHandler<GetPlaceByIdQuery, ApiPlaceDetail>
{
  constructor(private readonly em: EntityManager) {}

  async execute(query: GetPlaceByIdQuery): Promise<ApiPlaceDetail> {
    const id = query.props().id;
    const auth = query.auth();

    const result = await this.em
      .createQueryBuilder(Place, 'p')
      .leftJoinAndSelect('p.placeType', 'pt')
      .leftJoinAndSelect('p.author', 'a')
      .leftJoinAndSelect('a.profileImageId', 'pi')
      .where({ id })
      .getResult();

    if (result.length === 0) {
      throw new NotFoundException('Place not found');
    }

    const place = result[0];
    const placeType = place.placeType.unwrap() as unknown as ApiPlaceType;
    const author = place.author.unwrap();
    const profilePicture = author.profileImageId?.unwrap();

    const viewsCount = await this.em
      .createQueryBuilder(PlaceViewed)
      .where({ place: place.id })
      .getCount();
    const likesCount = await this.em
      .createQueryBuilder(PlaceLiked)
      .where({ place: place.id })
      .getCount();
    const exploredCount = await this.em
      .createQueryBuilder(PlaceExplored)
      .where({ place: place.id })
      .getCount();
    const nbGeocache = await this.em
      .createQueryBuilder(Review)
      .where({ place: place.id, geocache: true })
      .getCount();
    const note = await this.em.execute(
      `SELECT AVG(score) as avg_score
       FROM reviews
       WHERE place_id = ?`,
      [place.id],
    );
    const formattedNote = note[0].avg_score
      ? Number(note[0].avg_score)
      : undefined;

    const lastExplorers = await this.em
      .createQueryBuilder(PlaceExplored, 'p')
      .where('p.place_id = ? and p.user_id != ?', [place.id, author.id])
      .leftJoinAndSelect('p.user', 'u')
      .leftJoinAndSelect('u.profileImageId', 'pi')
      .orderBy({ updatedAt: 'DESC' });

    const lastExplorersUnwrapWithOutPhoto = lastExplorers.map((explorer) =>
      explorer.user.unwrap(),
    );

    const lastExplorersUnwrap = lastExplorersUnwrapWithOutPhoto.map(
      (explorer) => {
        return {
          id: explorer.id,
          lastName: explorer.lastName,
          profileImageUrl:
            explorer.profileImageId
              ?.unwrap()
              ?.findUrl(['png_small', 'webp_small', 'original']) ?? null,
        };
      },
    );

    return {
      id: place.id,
      title: place.title,
      text: place.text,
      address: place.address,
      accessibility: place.accessibility ?? null,
      sensible: place.sensible ?? false,
      geocaching: nbGeocache > 0,
      images: place.images.map((image) => ({
        id: image.id,
        url: image.url,
      })),
      author: {
        id: author.id,
        lastName: author.lastName,
        profileImageUrl: profilePicture
          ? profilePicture.findUrl(['png_small', 'webp_small', 'original'])
          : null,
      },
      type: placeType,
      location: {
        latitude: place.latitude,
        longitude: place.longitude,
      },
      metrics: {
        views: viewsCount,
        likes: likesCount,
        explored: exploredCount,
        note: formattedNote,
      },
      lastExplorers: lastExplorersUnwrap,
      requester: auth ? await this.requester(auth, place) : null,
      beginAt: place.beginAt ? new Date(Date.parse(place.beginAt)) : null,
      endAt: place.endAt ? new Date(Date.parse(place.endAt)) : null,
    };
  }

  private async requester(auth: AuthContext, place: Place) {
    const bookmark = await this.em
      .createQueryBuilder(PlaceBookmarked)
      .where({
        place: place.id,
        user: auth.id(),
      })
      .getSingleResult();

    const liked = await this.em
      .createQueryBuilder(PlaceLiked)
      .where({
        place: place.id,
        user: auth.id(),
      })
      .getSingleResult();

    const explored = await this.em
      .createQueryBuilder(PlaceExplored)
      .where({
        place: place.id,
        user: auth.id(),
      })
      .getSingleResult();

    return {
      bookmarked: !!bookmark,
      liked: !!liked,
      explored: !!explored,
    };
  }
}
