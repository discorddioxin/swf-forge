package com.gaiaonline.gateway
{
   import com.gaiaonline.serializers.JSONSerializer;
   
   public class GaiaIdentity
   {
      
      public var avatar:String = "";
      
      public var gid:Number = 0;
      
      public var filterLevel:uint = 0;
      
      public var userName:String = "";
      
      public var userLevel:uint = 0;
      
      public var gsid:String = "";
      
      public function GaiaIdentity(param1:String = "", param2:Number = 0, param3:String = "", param4:String = "")
      {
         super();
         this.userName = param1;
         this.gid = param2;
         this.avatar = param3;
         this.gsid = param4;
      }
      
      public function toObject() : Object
      {
         return null;
      }
      
      public function fromObject(param1:Object) : void
      {
         this.userName = param1.userName;
         this.gid = param1.gid;
         this.avatar = param1.avatar;
         this.userLevel = param1.userLevel;
         this.filterLevel = param1.filterLevel;
         if(param1.gsid)
         {
            this.gsid = param1.gsid;
         }
      }
      
      final public function toString() : String
      {
         return JSONSerializer.serialize(this);
      }
   }
}

