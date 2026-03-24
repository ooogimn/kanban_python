from rest_framework.exceptions import APIException


class QuotaExceeded(APIException):
    status_code = 403
    default_code = 'LIMIT_REACHED'
    default_detail = 'Лимит тарифа исчерпан.'

    def __init__(self, detail=None, *, limit=None, usage=None, metric=None):
        super().__init__(detail or self.default_detail)
        self.limit = limit
        self.usage = usage
        self.metric = metric


class FeatureLocked(APIException):
    status_code = 403
    default_code = 'FEATURE_LOCKED'
    default_detail = 'Функция недоступна на вашем тарифе.'

    def __init__(self, detail=None, *, feature=None):
        super().__init__(detail or self.default_detail)
        self.feature = feature
