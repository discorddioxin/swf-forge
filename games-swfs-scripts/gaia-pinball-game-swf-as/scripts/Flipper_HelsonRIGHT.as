package
{
   import com.gaiaonline.games.gPinball.compound_elements.Flipper;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1561")]
   public dynamic class Flipper_HelsonRIGHT extends Flipper
   {
      
      public function Flipper_HelsonRIGHT()
      {
         super();
         addFrameScript(0,frame1);
      }
      
      internal function frame1() : *
      {
         stop();
      }
   }
}

