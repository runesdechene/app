import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { getRepositoryToken, MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigService } from '@nestjs/config';
import {
  EntityManager,
  EntityRepository,
  PostgreSqlDriver,
} from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { AppController } from './application/controllers/app-controller.js';
import { DatabaseInterceptor } from '../adapters/for-production/database/database-interceptor.js';
import { AppExceptionFilter } from './application/exception-filters/exception-filter.js';
import { ImageMedia } from './domain/entities/image-media.js';
import { QueueModuleUtils } from '../adapters/for-production/queue/queue-module-utils.js';
import {
  IMAGE_COMPRESSING_WORKER,
  ImageCompressingWorker,
} from './application/services/media/image-processing-worker.js';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { MediaController } from './application/controllers/media-controller.js';
import { I_IMAGE_COMPRESSING_QUEUE } from './application/ports/queues/image-compressing-queue.js';
import { LocalConfig } from './application/services/shared/local-config/local-config.js';
import { getQueueToken } from '@nestjs/bullmq';
import { CompressImageCommandHandler } from './application/commands/medias/compress-image.js';
import { Queue } from 'bullmq';
import { SynchronousImageCompressingQueue } from '../adapters/for-tests/queue/synchronous-image-compressing-queue.js';
import { BullImageCompressingQueue } from '../adapters/for-production/queue/bull-image-compressing-queue.js';
import { MikroORM } from '@mikro-orm/core';
import { I_IMAGE_MEDIA_REPOSITORY } from './application/ports/repositories/image-media-repository.js';
import { SqlImageMediaRepository } from '../adapters/for-production/database/repositories/sql-image-media-repository.js';
import { StoreAsMediaCommandHandler } from './application/commands/medias/store-as-media.js';
import { StoreAsUrlCommandHandler } from './application/commands/medias/store-as-url.js';
import { CreateReportCommandHandler } from './application/commands/reports/create-report.js';
import { ReportController } from './application/controllers/report-controller.js';
import { Place } from './domain/entities/place.js';
import { PlaceType } from './domain/entities/place-type.js';
import { PlaceLiked } from './domain/entities/place-liked.js';
import { PlaceBookmarked } from './domain/entities/place-bookmarked.js';
import { PlaceViewed } from './domain/entities/place-viewed.js';
import { PlaceExplored } from './domain/entities/place-explored.js';
import { PlacesFeedQueryController } from './application/controllers/places-feed-query-controller.js';
import { PlacesActionsController } from './application/controllers/places-actions-controller.js';
import { PlaceTypesQueryController } from './application/controllers/place-types-query-controller.js';
import { PlacesCommandController } from './application/controllers/places-command-controller.js';
import { I_PLACE_REPOSITORY } from './application/ports/repositories/place-repository.js';
import { SqlPlaceRepository } from '../adapters/for-production/database/repositories/sql-place-repository.js';
import { I_PLACE_TYPE_REPOSITORY } from './application/ports/repositories/place-type-repository.js';
import { SqlPlaceTypeRepository } from '../adapters/for-production/database/repositories/sql-place-type-repository.js';
import { I_PLACE_LIKED_REPOSITORY } from './application/ports/repositories/place-liked-repository.js';
import { SqlPlaceLikedRepository } from '../adapters/for-production/database/repositories/sql-place-liked-repository.js';
import { I_PLACE_BOOKMARKED_REPOSITORY } from './application/ports/repositories/place-bookmarked-repository.js';
import { SqlPlaceBookmarkedRepository } from '../adapters/for-production/database/repositories/sql-place-bookmarked-repository.js';
import { I_PLACE_EXPLORED_REPOSITORY } from './application/ports/repositories/place-explored-repository.js';
import { SqlPlaceExploredRepository } from '../adapters/for-production/database/repositories/sql-place-explored-repository.js';
import { I_PLACE_VIEWED_REPOSITORY } from './application/ports/repositories/place-viewed-repository.js';
import { SqlPlaceViewedRepository } from '../adapters/for-production/database/repositories/sql-place-viewed-repository.js';
import { GetMapPlacesQueryHandler } from './application/queries/get-map-places.js';
import { GetRegularFeedQueryHandler } from './application/queries/get-regular-feed.js';
import { GetPlaceByIdQueryHandler } from './application/queries/get-place-by-id.js';
import { BookmarkPlaceCommandHandler } from './application/commands/places/bookmark-place.js';
import { ExplorePlaceCommandHandler } from './application/commands/places/explore-place.js';
import { LikePlaceCommandHandler } from './application/commands/places/like-place.js';
import { RemoveBookmarkPlaceCommandHandler } from './application/commands/places/remove-bookmark-place.js';
import { RemoveExplorePlaceCommandHandler } from './application/commands/places/remove-explore-place.js';
import { RemoveLikePlaceCommandHandler } from './application/commands/places/remove-like-place.js';
import { ViewPlaceCommandHandler } from './application/commands/places/view-place.js';
import { GetLikedPlacesQueryHandler } from './application/queries/get-liked-places.js';
import { GetExploredPlacesQueryHandler } from './application/queries/get-explored-places.js';
import { GetBookmarkedPlacesQueryHandler } from './application/queries/get-bookmarked-places.js';
import { GetAddedPlacesQueryHandler } from './application/queries/get-added-places.js';
import { GetRootPlaceTypesQueryHandler } from './application/queries/get-root-place-types.js';
import { GetChildrenPlaceTypesQueryHandler } from './application/queries/get-children-place-types.js';
import { CreatePlaceCommandHandler } from './application/commands/places/create-place.js';
import { UpdatePlaceCommandHandler } from './application/commands/places/update-place.js';
import { DeletePlaceCommandHandler } from './application/commands/places/delete-place.js';
import { AuthLoginController } from './application/controllers/auth-login-controller.js';
import { AuthUserController } from './application/controllers/auth-user-controller.js';
import { AuthPasswordController } from './application/controllers/auth-password-controller.js';
import { AuthRegisterController } from './application/controllers/auth-register-controller.js';
import { AdminAuthController } from './application/controllers/admin-auth-controller.js';
import { UsersQueryController } from './application/controllers/users-query-controller.js';
import { User } from './domain/entities/user.js';
import { RefreshToken } from './domain/entities/refresh-token.js';
import { PasswordReset } from './domain/entities/password-reset.js';
import { MemberCode } from './domain/entities/member-code.js';
import { I_USER_REPOSITORY } from './application/ports/repositories/user-repository.js';
import { SqlUserRepository } from '../adapters/for-production/database/repositories/sql-user-repository.js';
import { I_REFRESH_TOKEN_REPOSITORY } from './application/ports/repositories/refresh-token-repository.js';
import { SqlRefreshTokenRepository } from '../adapters/for-production/database/repositories/sql-refresh-token-repository.js';
import { I_PASSWORD_RESET_REPOSITORY } from './application/ports/repositories/password-reset-repository.js';
import { SqlPasswordResetRepository } from '../adapters/for-production/database/repositories/sql-password-reset-repository.js';
import { I_MEMBER_CODE_REPOSITORY } from './application/ports/repositories/member-code-repository.js';
import { SqlMemberCodeRepository } from '../adapters/for-production/database/repositories/sql-member-code-repository.js';
import { I_PASSWORD_STRATEGY } from './application/services/auth/password-strategy/password-strategy.interface.js';
import { Argon2Strategy } from './application/services/auth/password-strategy/argon2-strategy.js';
import { I_AUTH_CONFIG } from './application/services/auth/auth-config/auth-config.interface.js';
import { AuthConfig } from './application/services/auth/auth-config/auth-config.js';
import { Duration } from './libs/shared/duration.js';
import { I_JWT_SERVICE } from './application/services/auth/jwt-service/jwt-service.interface.js';
import { JwtService } from './application/services/auth/jwt-service/jwt-service.js';
import { I_ACCESS_TOKEN_FACTORY } from './application/services/auth/access-token-factory/access-token-factory.interface.js';
import { AccessTokenFactory } from './application/services/auth/access-token-factory/access-token-factory.js';
import { I_REFRESH_TOKEN_MANAGER } from './application/services/auth/refresh-token-manager/refresh-token-manager.interface.js';
import { RefreshTokenManager } from './application/services/auth/refresh-token-manager/refresh-token-manager.js';
import { AuthorizedGuard } from './application/guards/authorizer-guard.js';
import { I_PASSWORD_RESET_CODE_GENERATOR } from './application/services/auth/password-reset-code-generator/password-reset-code-generator.interface.js';
import { PasswordResetCodeGenerator } from './application/services/auth/password-reset-code-generator/password-reset-code-generator.js';
import { I_AUTHENTICATED_USER_VIEW_MODEL_FACTORY } from './application/services/auth/authenticated-user-view-model-factory/authenticated-user-view-model-factory.interface.js';
import { AuthenticatedUserViewModelFactory } from './application/services/auth/authenticated-user-view-model-factory/authenticated-user-view-model-factory.js';
import { MikroApiAdminUserConverter } from './application/admin-services/mikro-api-admin-user-converter.service.js';
import { Authorizer } from './application/services/auth/authorizer/authorizer.js';
import { LoginWithCredentialsCommandHandler } from './application/commands/auth/login-with-credentials.js';
import { LoginWithRefreshTokenCommandHandler } from './application/commands/auth/login-with-refresh-token.js';
import { GetMyInformationsHandler } from './application/queries/get-my-informations.js';
import { BeginPasswordResetCommandHandler } from './application/commands/auth/begin-password-reset.js';
import { EndPasswordResetCommandHandler } from './application/commands/auth/end-password-reset.js';
import { RegisterCommandHandler } from './application/commands/auth/register.js';
import { ChangeInformationsCommandHandler } from './application/commands/auth/change-informations.js';
import { ChangePasswordCommandHandler } from './application/commands/auth/change-password.js';
import { ActivateAccountCommandHandler } from './application/commands/auth/activate-account.js';
import { ChangeEmailAddressCommandHandler } from './application/commands/auth/change-email-address.js';
import { DeleteAccountCommandHandler } from './application/commands/auth/delete-account.js';
import { GetUserProfileQueryHandler } from './application/queries/get-user-profile.js';
import { GetAllUsersQueryHandler } from './application/admin-queries/get-all-users.js';
import { GetUserByIdQueryHandler } from './application/admin-queries/get-user-by-id.js';
import { GenerateCodesCLI } from './application/cli/generate-codes-cli.js';
import { ImportUsersCli } from './application/cli/import-users-cli.js';
import { ImportPlacesCli } from './application/cli/import-places-cli.js';
import { ImportPlaceActionsCli } from './application/cli/import-place-actions-cli.js';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import {
  BullEmailWorker,
  MAILER_WORKER,
} from './application/workers/bull-mailer-worker.js';
import { WINSTON_MODULE_PROVIDER, WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston/dist/winston.utilities.js';
import { I_DATE_PROVIDER } from './application/ports/services/date-provider.interface.js';
import { SystemDateProvider } from '../adapters/for-production/services/system-date-provider.js';
import { I_ID_PROVIDER } from './application/ports/services/id-provider.interface.js';
import { RandomIdProvider } from '../adapters/for-production/services/random-id-provider.js';
import { I_RANDOM_STRING_GENERATOR } from './application/ports/services/random-string-generator.interface.js';
import { SystemRandomStringGenerator } from '../adapters/for-production/services/system-random-string-generator.js';
import {
  I_EVENT_DISPATCHER,
  IEventDispatcher,
} from './application/ports/services/event-dispatcher.interface.js';
import { SystemEventDispatcher } from '../adapters/for-production/services/system-event-dispatcher.js';
import { AWSConfig, I_AWS_CONFIG } from './application/config/aws-config.js';
import {
  I_STORAGE,
  IStorage,
} from './application/ports/services/storage.interface.js';
import { S3Storage } from '../adapters/for-production/services/s3.storage.js';
import { SelfClearingStorageDecorator } from '../adapters/for-production/services/self-clearing-storage.decorator.js';
import { LoopbackMailer } from '../adapters/for-tests/services/loopback-mailer.js';
import { SESMailer } from '../adapters/for-production/services/ses-mailer.js';
import { NodemailerMailer } from '../adapters/for-production/services/nodemailer-mailer.js';
import { I_TRANSLATOR } from './libs/i18n/translator.js';
import { InHouseTranslator } from './libs/i18n/in-house-translator.js';
import { allTranslationKeys } from './libs/i18n/translation-keys.js';
import {
  I_MAILER,
  IMailer,
} from './application/ports/services/mailer.interface.js';
import { QueuedMailer } from '../adapters/for-production/services/queued-mailer.js';
import {
  I_LOGGER,
  ILogger,
} from './application/ports/services/logger.interface.js';
import { QuietLogger } from '../adapters/for-production/services/quiet-logger.js';
import { WinstonLogger } from '../adapters/for-production/services/winston-logger.js';
import { LoggingInterceptor } from './application/interceptors/logging-interceptor.js';
import { ConnectionManager } from '../adapters/for-production/queue/connection-manager.js';
import { I_REVIEW_REPOSITORY } from './application/ports/repositories/review-repository.js';
import { Review } from './domain/entities/review.js';
import { SqlReviewRepository } from '../adapters/for-production/database/repositories/sql-review-repository.js';
import { allEntities } from '../adapters/for-production/database/all-entities.js';
import { ReviewsQueryController } from './application/controllers/reviews-query-controller.js';
import { ReviewsCommandController } from './application/controllers/reviews-command-controller.js';
import { CreateReviewCommandHandler } from './application/commands/reviews/create-review.js';
import { UpdateReviewCommandHandler } from './application/commands/reviews/update-review.js';
import { DeleteReviewCommandHandler } from './application/commands/reviews/delete-review.js';
import { GetReviewByIdQueryHandler } from './application/queries/get-review-by-id-query.js';
import { GetPlaceReviewsQueryHandler } from './application/queries/get-place-reviews.js';
import { GetTotalPlacesQueryHandler } from './application/queries/get-total-places.js';
import { GetAdminStatsQueryHandler } from './application/admin-queries/get-admin-stats.js';
import { GetMapBannersQueryHandler } from './application/queries/get-map-banners.js';
import { GetBannerFeedQueryHandler } from './application/queries/get-banner-feed.js';
import { GetAdminRootPlaceTypesQueryHandler } from './application/admin-queries/get-admin-root-place-types.js';
import { GetAdminChildrenPlaceTypesQueryHandler } from './application/admin-queries/get-admin-children-place-types.js';

const RAW_MAILER = 'RAW_MAILER';

@Global()
@Module({
  imports: [
    CqrsModule.forRoot(),
    MikroOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isTestEnvironment = config.getOrThrow('ENVIRONMENT') === 'test';
        const useSsl = config.getOrThrow('DATABASE_USE_SSL') === 'yes';

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        const certPath = [
          path.join(__dirname, '..', '..', 'certificate.crt'),
          path.join(__dirname, '..', '..', '..', 'certificate.crt'),
        ].find((p) => fs.existsSync(p));

        if (!certPath) {
          throw new Error('Certificate not found');
        }

        return {
          clientUrl: config.getOrThrow('DATABASE_URL'),
          driver: PostgreSqlDriver,
          entities: allEntities,
          metadataProvider: TsMorphMetadataProvider,
          dynamicImportProvider: (id) => import(id),
          ...(isTestEnvironment
            ? {
                allowGlobalContext: true,
                disableIdentityMap: false,
              }
            : {}),
          ...(useSsl
            ? {
                driverOptions: {
                  connection: {
                    ssl: {
                      rejectUnauthorized: false,
                      ca: fs.readFileSync(certPath).toString(),
                    },
                  },
                },
              }
            : {}),
        };
      },
    }),
    MikroOrmModule.forFeature(allEntities),
    EventEmitterModule.forRoot(),
    WinstonModule.forRootAsync({
      useFactory: () => {
        return {
          transports: [
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.ms(),
                nestWinstonModuleUtilities.format.nestLike('Fellowship', {
                  colors: true,
                  prettyPrint: true,
                }),
              ),
            }),
          ],
        };
      },
    }),

    // Queues
    QueueModuleUtils.registerQueue({
      name: MAILER_WORKER,
    }),
    QueueModuleUtils.registerQueue({
      name: IMAGE_COMPRESSING_WORKER,
    }),
  ],
  controllers: [
    // Misc
    AppController,
    MediaController,
    ReportController,

    // Places
    PlacesFeedQueryController,
    PlacesActionsController,
    PlaceTypesQueryController,
    PlacesCommandController,
    ReviewsCommandController,
    ReviewsQueryController,

    // User
    AuthLoginController,
    AuthUserController,
    AuthPasswordController,
    AuthRegisterController,
    AdminAuthController,
    UsersQueryController,
  ],
  providers: [
    // Medias
    {
      provide: I_IMAGE_COMPRESSING_QUEUE,
      inject: [
        LocalConfig,
        getQueueToken(IMAGE_COMPRESSING_WORKER),
        CompressImageCommandHandler,
      ],
      useFactory: (
        config: LocalConfig,
        queue: Queue,
        compressImageCommandHandler: CompressImageCommandHandler,
      ) =>
        config.isTest()
          ? new SynchronousImageCompressingQueue(compressImageCommandHandler)
          : new BullImageCompressingQueue(queue),
    },
    {
      provide: ImageCompressingWorker,
      inject: [MikroORM, CommandBus],
      useFactory: (orm: MikroORM, commandBus: CommandBus) =>
        new ImageCompressingWorker(orm, commandBus),
    },
    {
      provide: I_IMAGE_MEDIA_REPOSITORY,
      inject: [EntityManager, getRepositoryToken(ImageMedia)],
      useFactory: (
        em: EntityManager,
        repository: EntityRepository<ImageMedia>,
      ) => new SqlImageMediaRepository(em, repository),
    },
    StoreAsMediaCommandHandler,
    CompressImageCommandHandler,
    StoreAsUrlCommandHandler,

    // Places
    {
      provide: I_PLACE_REPOSITORY,
      inject: [EntityManager, getRepositoryToken(Place)],
      useFactory: (em: EntityManager, repository: EntityRepository<Place>) =>
        new SqlPlaceRepository(em, repository),
    },
    {
      provide: I_PLACE_TYPE_REPOSITORY,
      inject: [EntityManager, getRepositoryToken(PlaceType)],
      useFactory: (
        em: EntityManager,
        repository: EntityRepository<PlaceType>,
      ) => new SqlPlaceTypeRepository(em, repository),
    },
    {
      provide: I_PLACE_LIKED_REPOSITORY,
      inject: [EntityManager, getRepositoryToken(PlaceLiked)],
      useFactory: (
        em: EntityManager,
        repository: EntityRepository<PlaceLiked>,
      ) => new SqlPlaceLikedRepository(em, repository),
    },
    {
      provide: I_PLACE_BOOKMARKED_REPOSITORY,
      inject: [EntityManager, getRepositoryToken(PlaceBookmarked)],
      useFactory: (
        em: EntityManager,
        repository: EntityRepository<PlaceBookmarked>,
      ) => new SqlPlaceBookmarkedRepository(em, repository),
    },
    {
      provide: I_PLACE_EXPLORED_REPOSITORY,
      inject: [EntityManager, getRepositoryToken(PlaceExplored)],
      useFactory: (
        em: EntityManager,
        repository: EntityRepository<PlaceExplored>,
      ) => new SqlPlaceExploredRepository(em, repository),
    },
    {
      provide: I_PLACE_VIEWED_REPOSITORY,
      inject: [EntityManager, getRepositoryToken(PlaceViewed)],
      useFactory: (
        em: EntityManager,
        repository: EntityRepository<PlaceViewed>,
      ) => new SqlPlaceViewedRepository(em, repository),
    },
    {
      provide: I_REVIEW_REPOSITORY,
      inject: [EntityManager, getRepositoryToken(Review)],
      useFactory: (em: EntityManager, repository: EntityRepository<Review>) =>
        new SqlReviewRepository(em, repository),
    },
    GetMapPlacesQueryHandler,
    GetMapBannersQueryHandler,
    GetRegularFeedQueryHandler,
    GetBannerFeedQueryHandler,
    GetPlaceByIdQueryHandler,
    BookmarkPlaceCommandHandler,
    ExplorePlaceCommandHandler,
    LikePlaceCommandHandler,
    RemoveBookmarkPlaceCommandHandler,
    RemoveExplorePlaceCommandHandler,
    RemoveLikePlaceCommandHandler,
    ViewPlaceCommandHandler,
    GetLikedPlacesQueryHandler,
    GetExploredPlacesQueryHandler,
    GetBookmarkedPlacesQueryHandler,
    GetAddedPlacesQueryHandler,
    GetTotalPlacesQueryHandler,
    GetRootPlaceTypesQueryHandler,
    GetChildrenPlaceTypesQueryHandler,
    CreatePlaceCommandHandler,
    UpdatePlaceCommandHandler,
    DeletePlaceCommandHandler,
    CreateReviewCommandHandler,
    UpdateReviewCommandHandler,
    DeleteReviewCommandHandler,
    GetReviewByIdQueryHandler,
    GetPlaceReviewsQueryHandler,

    // User & Auth
    {
      provide: I_USER_REPOSITORY,
      inject: [EntityManager, getRepositoryToken(User)],
      useFactory: (em: EntityManager, repository: EntityRepository<User>) =>
        new SqlUserRepository(em, repository),
    },
    {
      provide: I_REFRESH_TOKEN_REPOSITORY,
      inject: [EntityManager, getRepositoryToken(RefreshToken)],
      useFactory: (
        em: EntityManager,
        repository: EntityRepository<RefreshToken>,
      ) => new SqlRefreshTokenRepository(em, repository),
    },
    {
      provide: I_PASSWORD_RESET_REPOSITORY,
      inject: [EntityManager, getRepositoryToken(PasswordReset)],
      useFactory: (
        em: EntityManager,
        repository: EntityRepository<PasswordReset>,
      ) => new SqlPasswordResetRepository(em, repository),
    },
    {
      provide: I_MEMBER_CODE_REPOSITORY,
      inject: [EntityManager, getRepositoryToken(MemberCode)],
      useFactory: (
        em: EntityManager,
        repository: EntityRepository<MemberCode>,
      ) => new SqlMemberCodeRepository(em, repository),
    },
    {
      provide: I_PASSWORD_STRATEGY,
      useFactory: () => new Argon2Strategy(),
    },
    {
      provide: I_AUTH_CONFIG,
      useFactory: () =>
        new AuthConfig({
          refreshTokenLifetime: Duration.fromDays(365),
          accessTokenLifetime: Duration.fromHours(1),
          accessTokenSecret: 'u8URfjU8RnBxmRVxcdFaZGGMg19Y3gPo',
        }),
    },
    {
      provide: I_JWT_SERVICE,
      useClass: JwtService,
    },
    {
      provide: I_ACCESS_TOKEN_FACTORY,
      useClass: AccessTokenFactory,
    },
    {
      provide: I_REFRESH_TOKEN_MANAGER,
      useClass: RefreshTokenManager,
    },
    {
      provide: APP_GUARD,
      useClass: AuthorizedGuard,
    },
    {
      provide: I_PASSWORD_RESET_CODE_GENERATOR,
      useClass: PasswordResetCodeGenerator,
    },
    {
      provide: I_AUTHENTICATED_USER_VIEW_MODEL_FACTORY,
      useClass: AuthenticatedUserViewModelFactory,
    },
    MikroApiAdminUserConverter,
    Authorizer,
    LoginWithCredentialsCommandHandler,
    LoginWithRefreshTokenCommandHandler,
    GetMyInformationsHandler,
    BeginPasswordResetCommandHandler,
    EndPasswordResetCommandHandler,
    RegisterCommandHandler,
    ChangeInformationsCommandHandler,
    ChangePasswordCommandHandler,
    ActivateAccountCommandHandler,
    ChangeEmailAddressCommandHandler,
    DeleteAccountCommandHandler,
    GetUserProfileQueryHandler,
    GetAllUsersQueryHandler,
    GetUserByIdQueryHandler,
    GenerateCodesCLI,
    GetAdminStatsQueryHandler,
    GetAdminRootPlaceTypesQueryHandler,
    GetAdminChildrenPlaceTypesQueryHandler,
    // Misc
    {
      provide: APP_INTERCEPTOR,
      useClass: DatabaseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    CreateReportCommandHandler,
    ImportUsersCli,
    ImportPlacesCli,
    ImportPlaceActionsCli,

    // Shared

    LocalConfig,
    {
      provide: I_DATE_PROVIDER,
      useClass: SystemDateProvider,
    },
    {
      provide: I_ID_PROVIDER,
      useClass: RandomIdProvider,
    },
    {
      provide: I_RANDOM_STRING_GENERATOR,
      useClass: SystemRandomStringGenerator,
    },
    {
      provide: I_EVENT_DISPATCHER,
      inject: [EventEmitter2],
      useFactory: (eventEmitter: EventEmitter2) =>
        new SystemEventDispatcher(eventEmitter),
    },
    {
      provide: I_AWS_CONFIG,
      inject: [LocalConfig],
      useFactory: (config: LocalConfig): AWSConfig => {
        return {
          deploymentEnvironment: config.getOrThrow('AWS_DEPLOYMENT_ENV'),
          credentials: {
            accessKeyId: config.getOrThrow('AWS_ACCESS_KEY'),
            secretAccessKey: config.getOrThrow('AWS_SECRET_KEY'),
          },
          s3: {
            region: config.getOrThrow('AWS_S3_REGION'),
          },
        };
      },
    },
    {
      provide: I_STORAGE,
      inject: [LocalConfig, I_AWS_CONFIG, I_EVENT_DISPATCHER],
      useFactory: (
        config: LocalConfig,
        awsConfig: AWSConfig,
        eventDispatcher: IEventDispatcher,
      ) => {
        const storage: IStorage = new S3Storage(awsConfig, eventDispatcher);
        return config.isTest()
          ? new SelfClearingStorageDecorator(storage)
          : storage;
      },
    },
    {
      provide: RAW_MAILER,
      inject: [LocalConfig],
      useFactory: (config: LocalConfig) => {
        if (config.isTest()) {
          return new LoopbackMailer();
        }

        const host: string = config.getOrThrow('SMTP_HOST');
        if (host.endsWith('amazonaws.com')) {
          const region = host.split('.')[1];

          return new SESMailer({
            region,
            accessKeyId: config.getOrThrow('SMTP_USER'),
            secretAccessKey: config.getOrThrow('SMTP_PASSWORD'),
          });
        }

        return new NodemailerMailer({
          host: config.getOrThrow('SMTP_HOST'),
          port: parseInt(config.getOrThrow('SMTP_PORT'), 10),
          username: config.getOrThrow('SMTP_USER'),
          password: config.getOrThrow('SMTP_PASSWORD'),
        });
      },
    },
    {
      provide: I_TRANSLATOR,
      useFactory: () => new InHouseTranslator(allTranslationKeys),
    },
    {
      provide: I_MAILER,
      inject: [LocalConfig, getQueueToken(MAILER_WORKER), RAW_MAILER],
      useFactory: (config: LocalConfig, queue: Queue, mailer: IMailer) => {
        if (!config.isTest()) {
          return new QueuedMailer(queue);
        }

        return mailer;
      },
    },
    {
      provide: BullEmailWorker,
      inject: [MikroORM, RAW_MAILER],
      useFactory: (orm: MikroORM, mailer: IMailer) =>
        new BullEmailWorker(orm, mailer),
    },
    {
      provide: I_LOGGER,
      inject: [WINSTON_MODULE_PROVIDER, LocalConfig],
      useFactory: (winston: winston.Logger, config: LocalConfig) => {
        if (config.isTest()) {
          return new QuietLogger();
        }

        return new WinstonLogger(winston);
      },
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: ConnectionManager,
      inject: [I_LOGGER, LocalConfig],
      useFactory: (logger: ILogger, config: LocalConfig) =>
        new ConnectionManager(
          logger,
          config.getOrThrow('REDIS_CONNECTION_URL'),
          config,
        ),
    },
  ],
  exports: [
    I_IMAGE_MEDIA_REPOSITORY,
    I_PLACE_REPOSITORY,
    I_USER_REPOSITORY,
    ConnectionManager,
  ],
})
export class AppModule {}
